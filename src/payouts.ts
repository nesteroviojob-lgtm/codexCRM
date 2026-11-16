import {
  entries,
  findEntry,
  monthOf,
  overdueEntries,
  paidFor,
  remaining,
  round,
  today,
} from "./domain";
import type { Data, Entry, Payment, Project } from "./domain";

export type PayoutFilter =
  "all" | "unpaid" | "paid" | "partial" | "planned" | "overdue";
export interface PayoutPeriod {
  month: string;
  from?: string;
  to?: string;
  source?: string;
}
export interface PayoutGroup<T> {
  id: string;
  title: string;
  project?: Project;
  items: T[];
  planned: number;
  received: number;
  remaining: number;
  projected: number;
}
export interface Receipt {
  payment: Payment;
  entry: Entry;
}

const total = (values: number[]) =>
  round(values.reduce((sum, n) => sum + n, 0));

function inPeriod(date: string, period: PayoutPeriod) {
  return (
    monthOf(date) === period.month &&
    (!period.from || date >= period.from) &&
    (!period.to || date <= period.to)
  );
}

function matchesSource(entry: Entry, source = "all") {
  return (
    source === "all" || source === entry.type || source === entry.projectId
  );
}

function groupItems<T>(
  data: Data,
  items: T[],
  entryFor: (item: T) => Entry,
): PayoutGroup<T>[] {
  const groups = new Map<string, PayoutGroup<T>>();
  for (const item of items) {
    const entry = entryFor(item);
    const key = entry.type === "salary" ? "salary" : entry.projectId!;
    let group = groups.get(key);
    if (!group) {
      group = {
        id: key,
        title: entry.type === "salary" ? "Оклад" : entry.title,
        project: data.projects.find((p) => p.id === entry.projectId),
        items: [],
        planned: 0,
        received: 0,
        remaining: 0,
        projected: 0,
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) =>
    a.id === "salary"
      ? -1
      : b.id === "salary"
        ? 1
        : a.title.localeCompare(b.title, "ru"),
  );
}

/** Filter individual accruals before grouping; partial receipts never duplicate the plan. */
export function planPayoutGroups(
  data: Data,
  period: PayoutPeriod,
  filter: PayoutFilter = "all",
  asOf = today(),
) {
  const candidates =
    filter === "overdue"
      ? overdueEntries(data, asOf)
      : entries(data, period.month);
  const filtered = candidates.filter((entry) => {
    if (!matchesSource(entry, period.source)) return false;
    if (filter !== "overdue" && !inPeriod(entry.date, period)) return false;
    const paid = paidFor(data, entry.id);
    const left = remaining(data, entry);
    switch (filter) {
      case "unpaid":
        return left > 0;
      case "paid":
        return left === 0;
      case "partial":
        return paid > 0 && left > 0;
      case "planned":
        return !entry.eligible;
      default:
        return true;
    }
  });
  return groupItems(data, filtered, (entry) => entry).map((group) => ({
    ...group,
    planned: total(group.items.map((entry) => entry.amount)),
    received: total(group.items.map((entry) => paidFor(data, entry.id))),
    remaining: total(group.items.map((entry) => remaining(data, entry))),
    projected: total(
      group.items
        .filter((entry) => !entry.eligible)
        .map((entry) => entry.amount),
    ),
  }));
}

/** Receipt dates govern history, including receipts for a different month's plan. */
export function receivedPayoutGroups(data: Data, period: PayoutPeriod) {
  const receipts: Receipt[] = [];
  for (const payment of data.payments) {
    if (!inPeriod(payment.date, period)) continue;
    const entry = findEntry(data, payment.entryId);
    if (entry && matchesSource(entry, period.source))
      receipts.push({ entry, payment });
  }
  receipts.sort((a, b) => b.payment.date.localeCompare(a.payment.date));
  return groupItems(data, receipts, (item) => item.entry).map((group) => ({
    ...group,
    received: total(group.items.map(({ payment }) => payment.amount)),
  }));
}
