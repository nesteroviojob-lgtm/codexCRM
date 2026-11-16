import { describe, expect, it } from "vitest";
import { emptyData } from "./domain";
import type { Project, Stage } from "./domain";
import { planPayoutGroups, receivedPayoutGroups } from "./payouts";

function fixture() {
  const data = emptyData();
  data.settings.startMonth = "2026-10";
  data.settings.salaryPlans = [
    { from: "2026-10", first: 20000, second: 20000 },
    { from: "2027-01", first: 25000, second: 25000 },
  ];
  const stage = (
    id: string,
    amount: number,
    date: string,
    closed = true,
  ): Stage => ({
    id,
    name: id,
    amount,
    rate: 7,
    dueDate: date,
    status: closed ? "closed" : "active",
    closedDate: closed ? date : "",
  });
  const project: Project = {
    id: "project-one",
    name: "Одинаковое название",
    code: "П",
    color: "#dce9df",
    client: "",
    sheetUrl: "",
    note: "",
    archived: false,
    stages: [
      stage("partial", 10000, "2026-11-04"),
      stage("planned", 20000, "2026-11-01", false),
      stage("late", 30000, "2026-10-10"),
      stage("future", 40000, "2026-12-25", false),
    ],
  };
  data.projects = [
    project,
    {
      ...project,
      id: "project-two",
      archived: true,
      stages: [stage("paid", 5000, "2026-11-01")],
    },
  ];
  data.payments = [
    {
      id: "salary-nov",
      entryId: "salary-2026-11-01",
      amount: 20000,
      date: "2026-11-02",
      note: "",
    },
    {
      id: "salary-oct",
      entryId: "salary-2026-10-15",
      amount: 20000,
      date: "2026-11-04",
      note: "",
    },
    {
      id: "part-one",
      entryId: "partial",
      amount: 200,
      date: "2026-11-07",
      note: "",
    },
    {
      id: "part-two",
      entryId: "partial",
      amount: 100,
      date: "2026-11-18",
      note: "",
    },
    {
      id: "late-one",
      entryId: "late",
      amount: 800,
      date: "2026-11-11",
      note: "",
    },
    {
      id: "late-two",
      entryId: "late",
      amount: 1300,
      date: "2026-12-02",
      note: "",
    },
    { id: "full", entryId: "paid", amount: 350, date: "2026-11-01", note: "" },
  ];
  return data;
}

describe("Группировка выплат и фильтрация", () => {
  it("отделяет оклад и группирует по ID, сохраняя архивные проекты и одинаковые названия", () => {
    const data = fixture();
    const before = JSON.stringify(data);
    const groups = planPayoutGroups(data, { month: "2026-11" });
    expect(groups.map((group) => group.id)).toEqual([
      "salary",
      "project-one",
      "project-two",
    ]);
    expect(groups[1]).toMatchObject({
      planned: 2100,
      received: 300,
      remaining: 1800,
      projected: 1400,
    });
    expect(groups[0]).toMatchObject({
      planned: 40000,
      received: 20000,
      remaining: 20000,
      projected: 0,
    });
    expect(groups[2]).toMatchObject({
      planned: 350,
      received: 350,
      remaining: 0,
    });
    expect(JSON.stringify(data)).toBe(before);
  });
  it("пересчитывает группы по плановым датам до суммирования", () => {
    const groups = planPayoutGroups(fixture(), {
      month: "2026-11",
      from: "2026-11-15",
      to: "2026-11-15",
    });
    expect(groups.map((group) => group.id)).toEqual(["salary", "project-one"]);
    expect(groups[1]).toMatchObject({
      planned: 700,
      received: 300,
      remaining: 400,
      projected: 0,
    });
    expect(groups[1].items.map((entry) => entry.id)).toEqual(["partial"]);
  });
  it("различает полный факт, частичное получение, прогноз и оставшиеся выплаты", () => {
    const data = fixture();
    const ids = (filter: Parameters<typeof planPayoutGroups>[2]) =>
      planPayoutGroups(data, { month: "2026-11" }, filter).flatMap((group) =>
        group.items.map((entry) => entry.id),
      );
    expect(ids("paid")).toEqual(["salary-2026-11-01", "paid"]);
    expect(ids("partial")).toEqual(["partial"]);
    expect(ids("planned")).toEqual(["planned"]);
    expect(ids("unpaid")).toEqual(["salary-2026-11-15", "planned", "partial"]);
  });
  it("фильтрует источник вместе с датами и статусом", () => {
    const data = fixture();
    expect(
      planPayoutGroups(data, { month: "2026-11", source: "salary" }).map(
        (group) => group.id,
      ),
    ).toEqual(["salary"]);
    expect(
      planPayoutGroups(
        data,
        { month: "2026-11", source: "project-two" },
        "unpaid",
      ),
    ).toEqual([]);
    const groups = receivedPayoutGroups(data, {
      month: "2026-11",
      source: "project-one",
      from: "2026-11-10",
      to: "2026-11-18",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].received).toBe(900);
    expect(groups[0].items.map(({ payment }) => payment.id)).toEqual([
      "part-two",
      "late-one",
    ]);
  });
  it("история включает поздние поступления и суммирует только полученные в периоде части", () => {
    const data = fixture();
    const november = receivedPayoutGroups(data, { month: "2026-11" });
    expect(november[0].received).toBe(40000);
    expect(november[1].received).toBe(1100);
    expect(november[2].received).toBe(350);
    const december = receivedPayoutGroups(data, { month: "2026-12" });
    expect(december).toHaveLength(1);
    expect(december[0].received).toBe(1300);
    expect(december[0].items[0].entry.date).toBe("2026-10-15");
  });
  it("показывает будущий месяц, переход года и новые условия оклада", () => {
    const groups = planPayoutGroups(fixture(), { month: "2027-01" });
    expect(groups[0]).toMatchObject({
      planned: 50000,
      received: 0,
      remaining: 50000,
    });
    expect(groups[1]).toMatchObject({
      planned: 2800,
      projected: 2800,
      remaining: 2800,
    });
    expect(receivedPayoutGroups(fixture(), { month: "2027-01" })).toEqual([]);
  });
  it("в режиме просрочек сохраняет задолженность прошлых месяцев и применяет источник", () => {
    const data = fixture();
    data.payments = [];
    const groups = planPayoutGroups(
      data,
      { month: "2027-01", from: "2027-01-15", source: "project-one" },
      "overdue",
      "2026-11-16",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((entry) => entry.id)).toEqual([
      "late",
      "partial",
    ]);
    expect(groups[0].remaining).toBe(2800);
  });
  it("пустой и обратный диапазоны не показывают суммы других дат", () => {
    const data = fixture();
    const period = { month: "2026-11", from: "2026-11-15", to: "2026-11-01" };
    expect(planPayoutGroups(data, period)).toEqual([]);
    expect(receivedPayoutGroups(data, period)).toEqual([]);
    expect(planPayoutGroups(data, { month: "2026-09" })).toEqual([]);
  });
});
