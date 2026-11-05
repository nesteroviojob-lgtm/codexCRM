export type StageStatus = "planned" | "active" | "closed";
export interface Stage {
  id: string;
  name: string;
  amount: number;
  rate: number;
  dueDate: string;
  status: StageStatus;
  closedDate: string;
}
export interface Project {
  id: string;
  name: string;
  client: string;
  code: string;
  color: string;
  sheetUrl: string;
  note: string;
  archived: boolean;
  stages: Stage[];
}
export interface Payment {
  id: string;
  entryId: string;
  amount: number;
  date: string;
  note: string;
}
export interface SalaryPlan {
  from: string;
  first: number;
  second: number;
}
export interface Settings {
  name: string;
  rate: number;
  startMonth: string;
  salaryPlans: SalaryPlan[];
}
export interface Data {
  version: 1;
  demo: boolean;
  settings: Settings;
  projects: Project[];
  payments: Payment[];
}
export interface Entry {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  amount: number;
  eligible: boolean;
  type: "salary" | "bonus";
  projectId?: string;
  color?: string;
  code?: string;
}

export const COLORS = [
  "#dce9df",
  "#e4e4f0",
  "#f2e4d7",
  "#dae9ee",
  "#eee4e8",
  "#e8ead9",
];
export const id = () => crypto.randomUUID();
export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const bonus = (stage: Stage) => round((stage.amount * stage.rate) / 100);
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tomsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, by: number) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + by);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
export function dateLabel(date: string, long = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: long ? "long" : "short",
  }).format(new Date(`${date}T12:00:00`));
}
export function monthLabel(month: string) {
  const s = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T12:00:00`))
    .replace(" г.", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function nextPayday(date: string): string {
  const day = Number(date.slice(8, 10));
  if (day <= 1) return `${monthOf(date)}-01`;
  if (day <= 15) return `${monthOf(date)}-15`;
  return `${shiftMonth(monthOf(date), 1)}-01`;
}
export function paidFor(data: Data, entryId: string) {
  return round(
    data.payments
      .filter((p) => p.entryId === entryId)
      .reduce((sum, p) => sum + p.amount, 0),
  );
}
export const remaining = (data: Data, entry: Entry) =>
  Math.max(0, round(entry.amount - paidFor(data, entry.id)));
export function entries(data: Data, month: string): Entry[] {
  const plan = [...data.settings.salaryPlans]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find((p) => p.from <= month);
  const salary: Entry[] =
    month >= data.settings.startMonth && plan
      ? [1, 15].map((day, i) => ({
          id: `salary-${month}-${String(day).padStart(2, "0")}`,
          title: i === 0 ? "Оклад · первая выплата" : "Оклад · вторая выплата",
          subtitle: "Фиксированная часть",
          date: `${month}-${String(day).padStart(2, "0")}`,
          amount: i === 0 ? plan.first : plan.second,
          eligible: true,
          type: "salary",
        }))
      : [];
  const stages: Entry[] = data.projects.flatMap((project) =>
    project.stages.map((stage) => ({
      id: stage.id,
      title: project.name,
      subtitle: stage.name,
      date: nextPayday(
        stage.status === "closed" ? stage.closedDate : stage.dueDate,
      ),
      amount: bonus(stage),
      eligible: stage.status === "closed",
      type: "bonus" as const,
      projectId: project.id,
      color: project.color,
      code: project.code,
    })),
  );
  return [
    ...salary.filter((e) => e.amount > 0),
    ...stages.filter((e) => monthOf(e.date) === month),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type),
  );
}
export function overdueEntries(data: Data, asOf = today()): Entry[] {
  const months = new Set<string>();
  for (
    let m = data.settings.startMonth;
    m <= monthOf(asOf);
    m = shiftMonth(m, 1)
  )
    months.add(m);
  for (const project of data.projects)
    for (const stage of project.stages) {
      if (stage.status === "closed") {
        const m = monthOf(nextPayday(stage.closedDate));
        if (m <= monthOf(asOf)) months.add(m);
      }
    }
  return [...months]
    .flatMap((m) => entries(data, m))
    .filter((e) => e.eligible && e.date < asOf && remaining(data, e) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Nearest scheduled payout, including bonuses still conditional on stage closure. */
export function nextPaymentPlan(data: Data, asOf = today()) {
  const currentMonth = monthOf(asOf);
  const months = new Set([currentMonth, shiftMonth(currentMonth, 1)]);
  if (data.settings.startMonth >= currentMonth)
    months.add(data.settings.startMonth);
  for (const plan of data.settings.salaryPlans)
    if (plan.from >= currentMonth) months.add(plan.from);
  for (const project of data.projects)
    for (const stage of project.stages) {
      const month = monthOf(
        nextPayday(
          stage.status === "closed" ? stage.closedDate : stage.dueDate,
        ),
      );
      if (month >= currentMonth) months.add(month);
    }
  const upcoming = [...months]
    .flatMap((month) => entries(data, month))
    .filter((e) => e.date >= asOf && remaining(data, e) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const date = upcoming[0]?.date;
  const scheduled = upcoming.filter((e) => e.date === date);
  const total = (list: Entry[]) =>
    round(list.reduce((sum, e) => sum + remaining(data, e), 0));
  return {
    date,
    amount: total(scheduled),
    salary: total(scheduled.filter((e) => e.type === "salary")),
    bonus: total(scheduled.filter((e) => e.type === "bonus")),
    projectedBonus: total(scheduled.filter((e) => !e.eligible)),
  };
}

export function findEntry(data: Data, entryId: string): Entry | undefined {
  if (entryId.startsWith("salary-"))
    return entries(data, entryId.slice(7, 14)).find((e) => e.id === entryId);
  for (const p of data.projects) {
    const s = p.stages.find((s) => s.id === entryId);
    if (s)
      return entries(
        data,
        monthOf(nextPayday(s.status === "closed" ? s.closedDate : s.dueDate)),
      ).find((e) => e.id === entryId);
  }
}
export function registerPayment(
  data: Data,
  entry: Entry,
  amount: number,
  date: string,
  note = "",
): Data {
  if (!entry.eligible)
    throw new Error(
      "Сначала закройте этап — после этого можно отметить получение бонуса.",
    );
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    round(amount) !== amount ||
    amount > remaining(data, entry)
  )
    throw new Error(
      "Сумма должна быть больше нуля и не превышать остаток к выплате.",
    );
  if (!validDate(date) || date > today())
    throw new Error(
      "Укажите фактическую дату получения, не позднее сегодняшней.",
    );
  return {
    ...data,
    payments: [
      ...data.payments,
      { id: id(), entryId: entry.id, amount, date, note },
    ],
  };
}
export function emptyData(): Data {
  const month = monthOf(today());
  return {
    version: 1,
    demo: false,
    settings: {
      name: "Личное пространство",
      rate: 7,
      startMonth: month,
      salaryPlans: [{ from: month, first: 20000, second: 20000 }],
    },
    projects: [],
    payments: [],
  };
}
/** Clean the old starter workspace without removing projects added by the user. */
export function removeLegacyDemo(data: Data, asOf = today()): Data {
  if (!data.demo) return data;
  const examples = new Map([
    ["Сайт для «Архитек»", "Архитек · архитектурное бюро"],
    ["Личный кабинет Модуль", "Модуль · сервис для бизнеса"],
    ["Интернет-магазин Botanica", "Botanica · растения и декор"],
    ["Бренд-платформа Точка", "Точка · кофейня"],
  ]);
  let cleaned = data;
  for (const project of data.projects) {
    if (examples.get(project.name) === project.client)
      cleaned = removeProject(cleaned, project.id);
  }
  const lastDemoMonth = shiftMonth(data.settings.startMonth, 5);
  const isDemoSalary = (p: Payment) =>
    p.entryId === `salary-${p.date}` &&
    p.amount === 20000 &&
    !p.note &&
    monthOf(p.date) >= data.settings.startMonth &&
    monthOf(p.date) <= lastDemoMonth;
  // In a mixed workspace, salary records cannot reliably be distinguished from
  // personal receipts. Keep them; the user can remove them individually.
  const hasPersonalRecords =
    cleaned.projects.length > 0 ||
    cleaned.payments.some((p) => !isDemoSalary(p));
  cleaned = {
    ...cleaned,
    demo: false,
    payments: cleaned.payments.filter(
      (p) => hasPersonalRecords || !isDemoSalary(p),
    ),
  };
  // The starter's five past months must not turn into fictitious salary debt.
  if (!cleaned.projects.length && !cleaned.payments.length) {
    const month = monthOf(asOf);
    const plan = [...data.settings.salaryPlans]
      .sort((a, b) => b.from.localeCompare(a.from))
      .find((p) => p.from <= month);
    cleaned.settings = {
      ...data.settings,
      startMonth: month,
      salaryPlans: [
        {
          from: month,
          first: plan?.first ?? 20000,
          second: plan?.second ?? 20000,
        },
        ...data.settings.salaryPlans.filter((p) => p.from > month),
      ],
    };
  }
  return cleaned;
}

export function removeProject(data: Data, projectId: string): Data {
  const stageIds = new Set(
    data.projects.find((p) => p.id === projectId)?.stages.map((s) => s.id),
  );
  return {
    ...data,
    projects: data.projects.filter((p) => p.id !== projectId),
    payments: data.payments.filter((p) => !stageIds.has(p.entryId)),
  };
}

export type DeletedItem =
  | { kind: "project"; project: Project; payments: Payment[]; index: number }
  | { kind: "payment"; payment: Payment; index: number };

export function restoreDeleted(data: Data, item: DeletedItem): Data {
  const restored = {
    ...data,
    projects: [...data.projects],
    payments: [...data.payments],
  };
  if (item.kind === "project") {
    restored.projects.splice(item.index, 0, item.project);
    restored.payments.push(...item.payments);
  } else {
    restored.payments.splice(item.index, 0, item.payment);
  }
  // A later payment or import may conflict with undo; never save invalid totals.
  return parseBackup(JSON.stringify(restored));
}

export function paymentReminders(data: Data, asOf = today()): Entry[] {
  const end = new Date(`${asOf}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  const until = end.toISOString().slice(0, 10);
  const months = new Set([monthOf(asOf), monthOf(until)]);
  return [...months]
    .flatMap((month) => entries(data, month))
    .filter(
      (e) =>
        e.eligible &&
        e.date >= asOf &&
        e.date <= until &&
        remaining(data, e) > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function validMonth(v: unknown): v is string {
  return typeof v === "string" && validDate(`${v}-01`);
}
export function parseBackup(raw: string): Data {
  const d = JSON.parse(raw);
  const number = (x: unknown) =>
    typeof x === "number" &&
    Number.isFinite(x) &&
    x >= 0 &&
    x <= 1e12 &&
    round(x) === x;
  const text = (x: unknown) => typeof x === "string" && x.length <= 10000;
  const bad = () => {
    throw new Error(
      "Файл не похож на резервную копию «Доли» или содержит некорректные данные.",
    );
  };
  if (
    !d ||
    d.version !== 1 ||
    typeof d.demo !== "boolean" ||
    !d.settings ||
    !text(d.settings.name) ||
    !number(d.settings.rate) ||
    d.settings.rate > 100 ||
    !validMonth(d.settings.startMonth) ||
    !Array.isArray(d.settings.salaryPlans) ||
    !d.settings.salaryPlans.length ||
    !Array.isArray(d.projects) ||
    !Array.isArray(d.payments)
  )
    return bad();
  for (const p of d.settings.salaryPlans)
    if (!p || !validMonth(p.from) || !number(p.first) || !number(p.second))
      return bad();
  const ids = new Set<string>();
  for (const p of d.projects) {
    if (
      !p ||
      !text(p.id) ||
      !p.id ||
      ids.has(p.id) ||
      !text(p.name) ||
      !p.name.trim() ||
      !text(p.client) ||
      !text(p.code) ||
      !COLORS.includes(p.color) ||
      !text(p.note) ||
      typeof p.archived !== "boolean" ||
      !text(p.sheetUrl) ||
      (p.sheetUrl && !safeUrl(p.sheetUrl)) ||
      !Array.isArray(p.stages)
    )
      return bad();
    ids.add(p.id);
    for (const s of p.stages) {
      if (
        !s ||
        !text(s.id) ||
        !s.id ||
        s.id.startsWith("salary-") ||
        ids.has(s.id) ||
        !text(s.name) ||
        !s.name.trim() ||
        !number(s.amount) ||
        !number(s.rate) ||
        s.rate > 100 ||
        !["planned", "active", "closed"].includes(s.status) ||
        !validDate(s.dueDate) ||
        (s.status === "closed"
          ? !validDate(s.closedDate) || s.closedDate > today()
          : s.closedDate !== "")
      )
        return bad();
      ids.add(s.id);
    }
  }
  const paymentIds = new Set<string>();
  for (const p of d.payments) {
    if (
      !p ||
      !text(p.id) ||
      !p.id ||
      paymentIds.has(p.id) ||
      !text(p.entryId) ||
      !number(p.amount) ||
      p.amount <= 0 ||
      !validDate(p.date) ||
      p.date > today() ||
      !text(p.note)
    )
      return bad();
    paymentIds.add(p.id);
    const e = findEntry(d, p.entryId);
    if (!e || !e.eligible || paidFor(d, e.id) > e.amount) return bad();
  }
  return d as Data;
}
export function safeUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
