import { demoData } from "./legacy-demo.fixture";
import { describe, expect, it } from "vitest";
import {
  bonus,
  emptyData,
  entries,
  monthOf,
  nextPayday,
  overdueEntries,
  paidFor,
  parseBackup,
  paymentReminders,
  registerPayment,
  removeLegacyDemo,
  removeProject,
  restoreDeleted,
  remaining,
  shiftMonth,
  today,
} from "./domain";
import type { DeletedItem, Stage } from "./domain";

function fixture() {
  const d = emptyData();
  const s: Stage = {
    id: "stage-one",
    name: "Дизайн",
    amount: 180000,
    rate: 7,
    status: "active",
    dueDate: today(),
    closedDate: "",
  };
  d.projects.push({
    id: "project-one",
    name: "Первый проект",
    client: "",
    code: "П",
    color: "#dce9df",
    sheetUrl: "",
    note: "",
    archived: false,
    stages: [s],
  });
  return { d, s };
}
describe("Начисление бонуса и расписание", () => {
  it("считает 7% с округлением до копеек", () => {
    expect(bonus({ ...fixture().s, amount: 1234.56 })).toBe(86.42);
  });
  it.each([
    ["2026-11-01", "2026-11-01"],
    ["2026-11-02", "2026-11-15"],
    ["2026-11-15", "2026-11-15"],
    ["2026-11-16", "2026-12-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-29", "2028-03-01"],
  ])("закрытие %s → выплата %s", (date, payday) => {
    expect(nextPayday(date)).toBe(payday);
  });
  it("даёт фиксированные 40000 двумя выплатами", () => {
    const d = emptyData();
    expect(entries(d, monthOf(today())).map((e) => e.amount)).toEqual([
      20000, 20000,
    ]);
  });
  it("планирует открытые этапы, но не разрешает получать их бонус", () => {
    const { d, s } = fixture();
    const e = entries(d, monthOf(nextPayday(s.dueDate))).find(
      (e) => e.id === s.id,
    )!;
    expect(e.amount).toBe(12600);
    expect(e.eligible).toBe(false);
    expect(() => registerPayment(d, e, 12600, today())).toThrow(
      "Сначала закройте",
    );
  });
  it("переносит начисление по фактической дате закрытия и не дублирует этап", () => {
    const { d, s } = fixture();
    s.dueDate = "2026-10-05";
    s.status = "closed";
    s.closedDate = "2026-10-20";
    expect(entries(d, "2026-10").some((e) => e.id === s.id)).toBe(false);
    expect(entries(d, "2026-11").filter((e) => e.id === s.id)).toHaveLength(1);
  });
  it("архивирование сохраняет начисленные бонусы", () => {
    const { d, s } = fixture();
    s.status = "closed";
    s.closedDate = today();
    d.projects[0].archived = true;
    expect(
      entries(d, monthOf(nextPayday(today()))).find((e) => e.id === s.id)
        ?.eligible,
    ).toBe(true);
  });
  it("новые зарплатные условия не переписывают прошлые месяцы", () => {
    const d = emptyData();
    const current = monthOf(today());
    d.settings.salaryPlans.push({
      from: shiftMonth(current, 1),
      first: 25000,
      second: 25000,
    });
    expect(entries(d, current).map((e) => e.amount)).toEqual([20000, 20000]);
    expect(entries(d, shiftMonth(current, 1)).map((e) => e.amount)).toEqual([
      25000, 25000,
    ]);
  });
});
describe("Фактическое получение", () => {
  it("учитывает частичную выплату и остаток, защищает от переплаты", () => {
    const { d, s } = fixture();
    s.status = "closed";
    s.closedDate = today();
    const e = entries(d, monthOf(nextPayday(today()))).find(
      (e) => e.id === s.id,
    )!;
    const partial = registerPayment(d, e, 5000, today());
    expect(paidFor(partial, s.id)).toBe(5000);
    expect(remaining(partial, e)).toBe(7600);
    expect(() => registerPayment(partial, e, 7600.01, today())).toThrow(
      "Сумма",
    );
    const full = registerPayment(partial, e, 7600, today());
    expect(remaining(full, e)).toBe(0);
    expect(() => registerPayment(full, e, 1, today())).toThrow();
  });
  it("не принимает отрицательные, NaN, лишние копейки и будущую дату", () => {
    const d = emptyData();
    const e = entries(d, monthOf(today()))[0];
    for (const n of [-1, 0, NaN, Infinity, 1.001])
      expect(() => registerPayment(d, e, n, today())).toThrow();
    expect(() => registerPayment(d, e, 10, "2099-01-01")).toThrow("дату");
  });
});
describe("Восстановление резервной копии", () => {
  it("проверяет и восстанавливает реальные структуры и демо-данные", () => {
    for (const d of [emptyData(), fixture().d, demoData()])
      expect(parseBackup(JSON.stringify(d))).toEqual(d);
  });
  it("отвергает несуществующие этапы, неверные даты и переплату", () => {
    const d = emptyData();
    const p = {
      id: "pay",
      entryId: "unknown",
      amount: 100,
      date: today(),
      note: "",
    };
    d.payments.push(p);
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    p.entryId = entries(d, monthOf(today()))[0].id;
    p.date = "2026-02-31";
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    p.date = today();
    p.amount = 20001;
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });
  it("отвергает небезопасные ссылки и повторяющиеся ID этапов", () => {
    const { d, s } = fixture();
    d.projects[0].sheetUrl = "javascript:alert(1)";
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
    d.projects[0].sheetUrl = "";
    d.projects[0].stages.push({ ...s });
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });
});

describe("Задолженность из прошлых месяцев", () => {
  it("не теряет прошлые оклады и закрытые этапы при смене месяца", () => {
    const { d, s } = fixture();
    d.settings.startMonth = "2026-08";
    d.settings.salaryPlans = [{ from: "2026-08", first: 20000, second: 20000 }];
    s.status = "closed";
    s.closedDate = "2026-08-25";
    const overdue = overdueEntries(d, "2026-10-02");
    expect(overdue.filter((e) => e.type === "salary")).toHaveLength(5);
    expect(overdue.find((e) => e.id === s.id)?.date).toBe("2026-09-01");
    const salary = overdue.find((e) => e.id === "salary-2026-08-01")!;
    const paid = registerPayment(d, salary, 20000, "2026-08-01");
    expect(
      overdueEntries(paid, "2026-10-02").some((e) => e.id === salary.id),
    ).toBe(false);
  });
});

describe("Удаление и возврат записей", () => {
  it("удаляет проект, его этапы и поступления, сохраняя чужие выплаты", () => {
    const { d, s } = fixture();
    s.status = "closed";
    s.closedDate = today();
    const salary = entries(d, monthOf(today())).find(
      (e) => e.type === "salary",
    )!;
    const projectEntry = entries(d, monthOf(nextPayday(today()))).find(
      (e) => e.id === s.id,
    )!;
    const paid = registerPayment(
      registerPayment(d, projectEntry, 5000, today()),
      salary,
      1000,
      today(),
    );
    const deleted = removeProject(paid, "project-one");
    expect(deleted.projects).toHaveLength(0);
    expect(deleted.payments.map((p) => p.entryId)).toEqual([salary.id]);
    expect(parseBackup(JSON.stringify(deleted))).toEqual(deleted);
    const item: DeletedItem = {
      kind: "project",
      project: paid.projects[0],
      payments: paid.payments.filter((p) => p.entryId === s.id),
      index: 0,
    };
    const restored = restoreDeleted(deleted, item);
    expect(restored.projects).toEqual(paid.projects);
    expect(restored.payments).toEqual(expect.arrayContaining(paid.payments));
    expect(paid.projects).toHaveLength(1);
  });
  it("возвращает удалённую выплату, сохраняя последующие записи", () => {
    const d = emptyData();
    const e = entries(d, monthOf(today()))[0];
    const paid = registerPayment(d, e, 5000, today());
    const removed = { ...paid, payments: [] };
    const item: DeletedItem = {
      kind: "payment",
      payment: paid.payments[0],
      index: 0,
    };
    expect(remaining(removed, e)).toBe(e.amount);
    const later = registerPayment(removed, e, 1000, today());
    expect(paidFor(restoreDeleted(later, item), e.id)).toBe(6000);
    expect(() =>
      restoreDeleted(registerPayment(removed, e, e.amount, today()), item),
    ).toThrow();
  });
});

describe("Чистое пространство и совместимость", () => {
  it("очищает старый стартовый пример без фиктивного долга за прошлые месяцы", () => {
    const old = demoData();
    const clean = removeLegacyDemo(old);
    expect(clean.demo).toBe(false);
    expect(clean.projects).toEqual([]);
    expect(clean.payments).toEqual([]);
    expect(clean.settings.startMonth).toBe(monthOf(today()));
    expect(removeLegacyDemo(clean)).toBe(clean);
    expect(old.projects).toHaveLength(4);
    expect(parseBackup(JSON.stringify(clean))).toEqual(clean);
  });
  it("сохраняет личные проекты и выплаты, добавленные поверх примеров", () => {
    const old = demoData();
    const { d, s } = fixture();
    s.status = "closed";
    s.closedDate = today();
    old.projects.push(d.projects[0]);
    const entry = entries(old, monthOf(nextPayday(today()))).find(
      (e) => e.id === s.id,
    )!;
    const mixed = registerPayment(old, entry, 5000, today());
    const cleaned = removeLegacyDemo(mixed);
    expect(cleaned.projects).toEqual(d.projects);
    expect(paidFor(cleaned, s.id)).toBe(5000);
    // Ambiguous salary history is preserved rather than guessed away.
    expect(
      cleaned.payments.filter((p) => p.entryId.startsWith("salary-")),
    ).toEqual(old.payments.filter((p) => p.entryId.startsWith("salary-")));
    expect(parseBackup(JSON.stringify(cleaned))).toEqual(cleaned);
    const personal = { ...mixed, demo: false };
    expect(removeLegacyDemo(personal)).toBe(personal);
  });
});

describe("Напоминания за два дня", () => {
  it.each([
    ["2026-11-12", []],
    ["2026-11-13", ["2026-11-15"]],
    ["2026-11-14", ["2026-11-15"]],
    ["2026-11-15", ["2026-11-15"]],
    ["2026-11-16", []],
    ["2026-12-30", ["2027-01-01"]],
    ["2028-02-28", ["2028-03-01"]],
  ])("проверяет дату %s, включая переход месяца и года", (asOf, expected) => {
    const d = emptyData();
    d.settings.startMonth = "2026-01";
    d.settings.salaryPlans = [{ from: "2026-01", first: 20000, second: 20000 }];
    expect(paymentReminders(d, asOf).map((e) => e.date)).toEqual(expected);
  });
  it("напоминает о частично полученном остатке, исключает полученное и незакрытые этапы", () => {
    const { d, s } = fixture();
    d.settings.startMonth = "2026-01";
    d.settings.salaryPlans = [{ from: "2026-01", first: 20000, second: 20000 }];
    s.dueDate = "2026-11-12";
    expect(paymentReminders(d, "2026-11-13").some((e) => e.id === s.id)).toBe(
      false,
    );
    s.status = "closed";
    s.closedDate = "2026-11-12";
    const e = entries(d, "2026-11").find((e) => e.id === s.id)!;
    d.payments.push({
      id: "part",
      entryId: s.id,
      amount: 5000,
      date: "2026-11-13",
      note: "",
    });
    expect(
      remaining(
        d,
        paymentReminders(d, "2026-11-13").find((v) => v.id === s.id)!,
      ),
    ).toBe(7600);
    d.payments.push({
      id: "full",
      entryId: s.id,
      amount: 7600,
      date: "2026-11-13",
      note: "",
    });
    expect(paymentReminders(d, "2026-11-13").some((v) => v.id === s.id)).toBe(
      false,
    );
    expect(paymentReminders(d, "2026-11-16")).toEqual([]);
    expect(e.amount).toBe(12600);
  });
});
