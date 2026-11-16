import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle,
  FolderSimple,
  Info,
  Trash,
  Wallet,
} from "@phosphor-icons/react";
import {
  dateLabel,
  money,
  monthLabel,
  monthOf,
  paidFor,
  remaining,
  round,
  shiftMonth,
} from "./domain";
import type { Data, Entry, Payment } from "./domain";
import { planPayoutGroups, receivedPayoutGroups } from "./payouts";
import type { PayoutFilter } from "./payouts";

interface Props {
  data: Data;
  month: string;
  currentDate: string;
  monthControl: ReactNode;
  onMonth: (month: string) => void;
  tab: string;
  onTab: (tab: string) => void;
  filter: PayoutFilter;
  onFilter: (filter: PayoutFilter) => void;
  onReceive: (entry: Entry) => void;
  onDelete: (payment: Payment) => void;
}

const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));
const fullDate = (date: string) =>
  `${dateLabel(date, true)} ${date.slice(0, 4)}`;

function PayoutStatus({
  data,
  entry,
  currentDate,
}: {
  data: Data;
  entry: Entry;
  currentDate: string;
}) {
  const left = remaining(data, entry);
  const paid = paidFor(data, entry.id);
  if (!left)
    return (
      <span className="badge success">
        <Check size={12} />
        Получено
      </span>
    );
  if (paid)
    return (
      <span className="badge warning">
        <span />
        Частично получено
      </span>
    );
  if (!entry.eligible)
    return (
      <span className="badge neutral">
        <span />
        Планируется
      </span>
    );
  return (
    <span
      className={`badge ${entry.date < currentDate ? "warning" : "neutral"}`}
    >
      <span />
      {entry.date < currentDate ? "Ожидает получения" : "К выплате"}
    </span>
  );
}

export default function PaymentsView({
  data,
  month,
  currentDate,
  monthControl,
  onMonth,
  tab,
  onTab,
  filter,
  onFilter,
  onReceive,
  onDelete,
}: Props) {
  const [source, setSource] = useState("all");
  const [range, setRange] = useState({ month, from: "", to: "" });
  const from = range.month === month ? range.from : "";
  const to = range.month === month ? range.to : "";
  const monthEnd = new Date(
    Date.parse(`${shiftMonth(month, 1)}-01T00:00:00Z`) - 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const history = tab === "history";
  const allMonths = !history && filter === "overdue";
  const invalidRange = !allMonths && !!from && !!to && from > to;
  const period = { month, from, to, source };
  const plans = planPayoutGroups(data, period, filter, currentDate);
  const receipts = receivedPayoutGroups(data, period);
  const groups = history ? receipts : plans;
  const planned = sum(plans.map((group) => group.planned));
  const received = sum(groups.map((group) => group.received));
  const left = sum(plans.map((group) => group.remaining));
  const projected = sum(plans.map((group) => group.projected));
  const salaryReceived =
    receipts.find((group) => group.id === "salary")?.received ?? 0;
  const rangeChanged =
    !!from || !!to || source !== "all" || (!history && filter !== "all");

  function resetFilters() {
    setSource("all");
    setRange({ month, from: "", to: "" });
    onFilter("all");
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">От начисления до поступления</div>
          <h1>Мои выплаты</h1>
          <p>
            Оклад отдельно, бонусы — по проектам. План и фактические поступления
            за выбранный период.
          </p>
        </div>
      </div>
      <div className="payout-period-bar">
        <div className="payout-period-picker">
          <span>Месяц выплат</span>
          {monthControl}
          {month !== monthOf(currentDate) && (
            <button
              className="text-button"
              onClick={() => {
                onMonth(monthOf(currentDate));
                onFilter("all");
              }}
            >
              Текущий месяц
            </button>
          )}
        </div>
        <p>Можно выбрать прошлый или будущий месяц</p>
      </div>
      <div className="list-toolbar payout-tabs">
        <div className="tabs" role="group" aria-label="Представление выплат">
          <button
            className={!history ? "active" : ""}
            aria-pressed={!history}
            onClick={() => onTab("expected")}
          >
            План выплат
          </button>
          <button
            className={history ? "active" : ""}
            aria-pressed={history}
            onClick={() => onTab("history")}
          >
            История поступлений
          </button>
        </div>
      </div>
      <div className="payout-filters" aria-label="Фильтры выплат">
        <label>
          Источник
          <select
            aria-label="Источник выплат"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">Все источники</option>
            <option value="salary">Только оклад</option>
            <option value="bonus">Все проекты</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.archived ? " · архив" : ""}
              </option>
            ))}
          </select>
        </label>
        {!history && (
          <label>
            Статус выплаты
            <select
              aria-label="Фильтр выплат"
              value={filter}
              onChange={(e) => onFilter(e.target.value as PayoutFilter)}
            >
              <option value="all">Все выплаты</option>
              <option value="unpaid">Осталось получить</option>
              <option value="paid">Получено полностью</option>
              <option value="partial">Получено частично</option>
              <option value="planned">Планируется · этап не закрыт</option>
              <option value="overdue">Просроченные за всё время</option>
            </select>
          </label>
        )}
        <label>
          {history ? "Дата получения с" : "Плановая дата с"}
          <input
            type="date"
            value={from}
            min={`${month}-01`}
            max={monthEnd}
            disabled={allMonths}
            onChange={(e) => {
              const value = e.target.value;
              if (!value || monthOf(value) === month)
                setRange({ month, from: value, to });
            }}
          />
        </label>
        <label>
          {history ? "Дата получения по" : "Плановая дата по"}
          <input
            type="date"
            value={to}
            min={`${month}-01`}
            max={monthEnd}
            disabled={allMonths}
            onChange={(e) => {
              const value = e.target.value;
              if (!value || monthOf(value) === month)
                setRange({ month, from, to: value });
            }}
          />
        </label>
        {rangeChanged && (
          <button className="text-button payout-reset" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        )}
      </div>
      {invalidRange && (
        <p className="payout-range-error" role="alert">
          Дата начала должна быть не позже даты окончания.
        </p>
      )}
      <p className="payout-period-note">
        {allMonths
          ? "Просроченные начисления за все месяцы. Фильтр источника применяется; выбранный месяц и диапазон дат не ограничивают задолженность."
          : history
            ? "История учитывает дату фактического поступления, в том числе выплаты по плану прошлых месяцев."
            : "План учитывает плановую дату. «Получено по плану» включает все поступления по этим начислениям, даже если деньги пришли в другом месяце."}
      </p>
      <section
        className="metrics project-metrics payout-metrics"
        aria-label="Итоги по фильтрам"
        aria-live="polite"
      >
        <div className="metric lead">
          <span>{history ? "Получено за период" : "План по фильтрам"}</span>
          <strong>{money(history ? received : planned)}</strong>
          <small>
            {allMonths ? "Просроченные начисления" : monthLabel(month)}
          </small>
        </div>
        <div className="metric">
          <span>{history ? "Из них оклад" : "Получено по плану"}</span>
          <strong>{money(history ? salaryReceived : received)}</strong>
          <small>
            {history ? "Фиксированная часть" : "По выбранным начислениям"}
          </small>
        </div>
        <div className="metric">
          <span>{history ? "Из них бонусы" : "Осталось по плану"}</span>
          <strong>
            {money(history ? round(received - salaryReceived) : left)}
          </strong>
          <small>
            {history
              ? "Выплаты по проектам"
              : `Из них прогноз: ${money(projected)}`}
          </small>
        </div>
      </section>
      <div className="payout-list-heading">
        <h2>
          {history
            ? "Полученные деньги"
            : allMonths
              ? "Ожидают получения · все месяцы"
              : `План на ${monthLabel(month).toLocaleLowerCase("ru")}`}
        </h2>
        <span className="subtle">
          {groups.length ? `Групп: ${groups.length}` : "Нет выплат"}
        </span>
      </div>
      <div className="payout-groups">
        {groups.map((group) => (
          <section
            className={`panel payout-group ${group.id === "salary" ? "payout-salary" : ""}`}
            aria-label={group.title}
            key={group.id}
          >
            <div className="payout-group-header">
              <div className="payment-source">
                {group.project ? (
                  <span
                    className="project-avatar"
                    style={{ background: group.project.color }}
                  >
                    {group.project.code}
                  </span>
                ) : (
                  <span className="salary-avatar">
                    <Wallet size={20} />
                  </span>
                )}
                <div>
                  <h3>{group.title}</h3>
                  <small>
                    {group.id === "salary"
                      ? "Фиксированная часть"
                      : "Бонусы за этапы"}
                    {group.project?.archived ? " · проект в архиве" : ""}
                  </small>
                </div>
              </div>
              <div className="payout-group-totals">
                {!history && (
                  <div>
                    <span>План</span>
                    <strong>{money(group.planned)}</strong>
                  </div>
                )}
                <div>
                  <span>
                    {history ? "Получено за период" : "Получено по плану"}
                  </span>
                  <strong className="positive">{money(group.received)}</strong>
                </div>
                {!history && (
                  <div>
                    <span>Остаток</span>
                    <strong>{money(group.remaining)}</strong>
                  </div>
                )}
              </div>
            </div>
            <div className="table-scroll">
              {!history ? (
                <table className="payments-table payout-table">
                  <thead>
                    <tr>
                      <th>Этап / выплата</th>
                      <th>Плановая дата</th>
                      <th className="numeric">План</th>
                      <th className="numeric">Получено</th>
                      <th className="numeric">Остаток</th>
                      <th>Статус</th>
                      <th>
                        <span className="sr-only">Действие</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans
                      .find((plan) => plan.id === group.id)!
                      .items.map((entry) => (
                        <tr key={entry.id}>
                          <td data-label="Этап / выплата">
                            <strong>
                              {entry.type === "salary"
                                ? entry.title
                                : entry.subtitle}
                            </strong>
                          </td>
                          <td data-label="Плановая дата">
                            {fullDate(entry.date)}
                          </td>
                          <td data-label="План" className="numeric">
                            {money(entry.amount)}
                          </td>
                          <td
                            data-label="Получено"
                            className="numeric positive"
                          >
                            {money(paidFor(data, entry.id))}
                          </td>
                          <td data-label="Остаток" className="numeric">
                            {money(remaining(data, entry))}
                          </td>
                          <td data-label="Статус">
                            <PayoutStatus
                              data={data}
                              entry={entry}
                              currentDate={currentDate}
                            />
                          </td>
                          <td className="payout-row-action">
                            {entry.eligible && remaining(data, entry) > 0 ? (
                              <button
                                className="button compact"
                                onClick={() => onReceive(entry)}
                              >
                                Отметить получение
                                <ArrowDownLeft size={14} />
                              </button>
                            ) : !entry.eligible ? (
                              <a
                                className="text-button"
                                href={`#projects/${entry.projectId}`}
                              >
                                К этапу
                                <ArrowUpRight size={14} />
                              </a>
                            ) : (
                              <CheckCircle
                                size={19}
                                className="positive"
                                aria-label="Получено полностью"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <table className="payments-table payout-table payout-history-table">
                  <thead>
                    <tr>
                      <th>Этап / выплата</th>
                      <th>Дата получения</th>
                      <th>Плановая дата</th>
                      <th>Комментарий</th>
                      <th className="numeric">Сумма</th>
                      <th>
                        <span className="sr-only">Удаление выплаты</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts
                      .find((receipt) => receipt.id === group.id)!
                      .items.map(({ entry, payment }) => (
                        <tr key={payment.id}>
                          <td data-label="Этап / выплата">
                            <strong>
                              {entry.type === "salary"
                                ? entry.title
                                : entry.subtitle}
                            </strong>
                          </td>
                          <td data-label="Дата получения">
                            {fullDate(payment.date)}
                          </td>
                          <td data-label="Плановая дата">
                            {fullDate(entry.date)}
                          </td>
                          <td data-label="Комментарий" className="muted">
                            {payment.note || "—"}
                          </td>
                          <td data-label="Сумма" className="numeric positive">
                            +{money(payment.amount)}
                          </td>
                          <td className="payout-row-action">
                            <button
                              className="icon-button danger-button"
                              aria-label={`Удалить выплату ${money(payment.amount)}`}
                              title="Удалить выплату — сумма вернётся в остаток"
                              onClick={() => onDelete(payment)}
                            >
                              <Trash size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ))}
        {!groups.length && (
          <section className="panel">
            <div className="empty">
              <FolderSimple size={30} weight="light" />
              <h3>
                {history
                  ? "Поступлений пока нет"
                  : "Нет выплат по выбранным условиям"}
              </h3>
              <p>
                {history
                  ? "Отметьте получение в плане выплат или выберите другой период."
                  : "Выберите другой месяц, диапазон дат или статус выплаты."}
              </p>
              {rangeChanged && (
                <button className="button compact" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
              )}
            </div>
          </section>
        )}
      </div>
      {!history && (
        <div className="payout-footnote">
          <Info size={16} />
          <p>
            Бонусы незакрытых этапов входят в план и остаток, но станут доступны
            к получению после закрытия этапов.
          </p>
        </div>
      )}
    </>
  );
}
