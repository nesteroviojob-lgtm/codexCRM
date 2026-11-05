import { useEffect, useRef, useState, useDeferredValue } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  SquaresFour,
  FolderSimple,
  Wallet,
  GearSix,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  X,
  MagnifyingGlass,
  CalendarBlank,
  DownloadSimple,
  UploadSimple,
  ArrowDownLeft,
  DotsThree,
  ArrowCounterClockwise,
  ArrowSquareOut,
  FileText,
  Info,
  ChartBar,
  ShieldCheck,
  Trash,
  PencilSimple,
  BellRinging,
} from "@phosphor-icons/react";
import {
  COLORS,
  bonus,
  dateLabel,
  emptyData,
  entries,
  findEntry,
  id,
  incomeForMonth,
  money,
  monthLabel,
  monthOf,
  nextPayday,
  nextPaymentPlan,
  paidFor,
  overdueEntries,
  parseBackup,
  paymentReminders,
  registerPayment,
  removeLegacyDemo,
  removeProject,
  restoreDeleted,
  remaining,
  round,
  safeUrl,
  shiftMonth,
  today,
} from "./domain";
import type {
  Data,
  DeletedItem,
  Entry,
  IncomeMode,
  Payment,
  Project,
  Stage,
  StageStatus,
} from "./domain";

const STORAGE_KEY = "dolya-crm-v1";
const LEGACY_BACKUP_KEY = "dolya-crm-before-demo-removal-v1";
function prepareData(data: Data, raw: string): Data {
  if (data.demo && !localStorage.getItem(LEGACY_BACKUP_KEY))
    localStorage.setItem(LEGACY_BACKUP_KEY, raw);
  return removeLegacyDemo(data);
}
const statusLabels: Record<StageStatus, string> = {
  planned: "Запланирован",
  active: "В работе",
  closed: "Закрыт",
};
const nav = [
  { id: "overview", label: "Обзор", icon: SquaresFour },
  { id: "projects", label: "Проекты", icon: FolderSimple },
  { id: "payments", label: "Выплаты", icon: Wallet },
];
const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));
function readInitial(): { data: Data; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      data: raw ? prepareData(parseBackup(raw), raw) : emptyData(),
      error: "",
    };
  } catch {
    return {
      data: emptyData(),
      error:
        "Не удалось прочитать сохранённые данные. Исходная копия сохранена в браузере. Экспортируйте её перед продолжением.",
    };
  }
}
function navigate(route: string) {
  window.location.hash = route;
}
function Avatar({
  project,
  small = false,
}: {
  project: Pick<Project, "code" | "color">;
  small?: boolean;
}) {
  return (
    <span
      className={`project-avatar ${small ? "small" : ""}`}
      style={{ background: project.color }}
    >
      {project.code}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderSimple size={30} weight="light" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть окно"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function ProjectForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: Project;
  onSave: (p: Project) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [client, setClient] = useState(existing?.client ?? "");
  const [sheetUrl, setSheetUrl] = useState(existing?.sheetUrl ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (sheetUrl && !safeUrl(sheetUrl)) {
      setError("Укажите полную ссылку, начинающуюся с https://");
      return;
    }
    onSave({
      id: existing?.id ?? id(),
      name: name.trim(),
      client: client.trim(),
      sheetUrl,
      note,
      color,
      code: name.trim().slice(0, 2),
      archived: existing?.archived ?? false,
      stages: existing?.stages ?? [],
    });
  }
  return (
    <Modal
      title={existing ? "Редактировать проект" : "Новый проект"}
      description="Сначала проект, затем его этапы и ваш бонус."
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        <label>
          Название проекта
          <input
            required
            autoFocus
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, сайт для архитектурного бюро"
          />
        </label>
        <label>
          Клиент
          <input
            value={client}
            maxLength={100}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Компания или имя клиента"
          />
        </label>
        <label>
          Бюджет в Google Таблицах{" "}
          <span className="optional">необязательно</span>
          <input
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/…"
          />
          <span className="field-hint">
            Ссылка для быстрого перехода. Автоматической синхронизации пока нет.
          </span>
        </label>
        <label>
          Заметка
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Договорённости и всё, что важно помнить"
          />
        </label>
        <fieldset className="color-picker">
          <legend>Метка проекта</legend>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              style={{ background: c }}
              className={c === color ? "selected" : ""}
              aria-label={`Метка ${COLORS.indexOf(c) + 1}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            >
              {color === c && <Check size={18} />}
            </button>
          ))}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" disabled={!name.trim()}>
            {existing ? "Сохранить" : "Создать проект"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function StageForm({
  project,
  existing,
  rate,
  onSave,
  onClose,
}: {
  project: Project;
  existing?: Stage;
  rate: number;
  onSave: (s: Stage) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing?.amount.toString() ?? "");
  const [percent, setPercent] = useState(
    existing?.rate.toString() ?? rate.toString(),
  );
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? today());
  const [status, setStatus] = useState<StageStatus>(
    existing?.status ?? "active",
  );
  const [closedDate, setClosedDate] = useState(existing?.closedDate || today());
  return (
    <Modal
      title={existing ? "Редактировать этап" : "Новый этап"}
      description={project.name}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: existing?.id ?? id(),
            name: name.trim(),
            amount: Number(amount),
            rate: Number(percent),
            dueDate,
            status,
            closedDate: status === "closed" ? closedDate : "",
          });
        }}
      >
        <label>
          Название этапа
          <input
            required
            autoFocus
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, дизайн-концепция"
          />
        </label>
        <div className="form-grid">
          <label>
            Бюджет этапа, ₽
            <input
              required
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="180000"
            />
          </label>
          <label>
            Ваша доля, %
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </label>
        </div>
        <div className="bonus-preview">
          <span>Ваш бонус с этапа</span>
          <strong>
            {money(
              round(((Number(amount) || 0) * (Number(percent) || 0)) / 100),
            )}
          </strong>
        </div>
        <div className="form-grid">
          <label>
            Плановое закрытие
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            Статус
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StageStatus)}
            >
              <option value="planned">Запланирован</option>
              <option value="active">В работе</option>
              <option value="closed">Закрыт</option>
            </select>
          </label>
        </div>
        {status === "closed" && (
          <label>
            Фактическая дата закрытия
            <input
              required
              type="date"
              max={today()}
              value={closedDate}
              onChange={(e) => setClosedDate(e.target.value)}
            />
            <span className="field-hint">
              Бонус ожидается{" "}
              {closedDate
                ? dateLabel(nextPayday(closedDate), true)
                : "после выбора даты"}{" "}
              — в ближайшую выплату после закрытия.
            </span>
          </label>
        )}
        <div className="form-footer">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" disabled={!name.trim()}>
            Сохранить этап
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PaymentForm({
  data,
  entry,
  onSave,
  onClose,
}: {
  data: Data;
  entry: Entry;
  onSave: (d: Data) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(remaining(data, entry)));
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal
      title="Отметить получение"
      description={`${entry.title} · ${entry.subtitle}`}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(registerPayment(data, entry, Number(amount), date, note));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="bonus-preview">
          <span>Осталось получить</span>
          <strong>{money(remaining(data, entry))}</strong>
        </div>
        <label>
          Полученная сумма, ₽
          <input
            autoFocus
            type="number"
            required
            min="0.01"
            max={remaining(data, entry)}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="field-hint">
            Можно указать часть суммы — остаток останется к выплате.
          </span>
        </label>
        <label>
          Дата получения
          <input
            required
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Комментарий <span className="optional">необязательно</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например, перевод на карту"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" className="button" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary">
            Подтвердить получение
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function IncomeChart({
  data,
  month,
  currentMonth,
  onMonth,
}: {
  data: Data;
  month: string;
  currentMonth: string;
  onMonth: (m: string) => void;
}) {
  const [endMonth, setEndMonth] = useState(month);
  const [mode, setMode] = useState<IncomeMode>(
    month > currentMonth ? "plan" : "received",
  );
  useEffect(() => {
    setEndMonth((end) =>
      month < shiftMonth(end, -5) || month > end ? month : end,
    );
    if (month > currentMonth) setMode("plan");
  }, [month, currentMonth]);
  const months = Array.from({ length: 6 }, (_, i) =>
    shiftMonth(endMonth, i - 5),
  );
  const values = months.map((m) => incomeForMonth(data, m, mode));
  const selected =
    values.find((v) => v.month === month) ?? values[values.length - 1];
  const max = Math.max(20000, ...values.map((v) => v.total));
  const ceiling = Math.ceil(max / 20000) * 20000;
  function move(by: number) {
    const next = shiftMonth(endMonth, by);
    setEndMonth(next);
    if (next > currentMonth) setMode("plan");
    onMonth(next);
  }
  function reset() {
    setEndMonth(currentMonth);
    setMode("received");
    onMonth(currentMonth);
  }
  return (
    <section className="panel income-panel" aria-label="Динамика дохода">
      <div className="section-header">
        <div>
          <h2>Динамика дохода</h2>
          <p>
            {mode === "plan"
              ? "План дохода по датам выплат"
              : "Фактически получено по датам поступлений"}
          </p>
        </div>
        <ChartBar size={20} className="muted" aria-hidden="true" />
      </div>
      <div className="chart-controls">
        <div className="chart-mode" role="group" aria-label="Режим графика">
          <button
            aria-pressed={mode === "received"}
            onClick={() => setMode("received")}
          >
            Получено
          </button>
          <button
            aria-pressed={mode === "plan"}
            onClick={() => setMode("plan")}
          >
            План
          </button>
        </div>
        <div className="chart-period" role="group" aria-label="Период графика">
          <button
            className="icon-button"
            aria-label="Показать предыдущие месяцы"
            onClick={() => move(-1)}
          >
            <CaretLeft size={16} />
          </button>
          <span aria-live="polite" aria-atomic="true">
            {monthLabel(months[0])} — {monthLabel(endMonth)}
          </span>
          <button
            className="icon-button"
            aria-label="Показать следующие месяцы"
            onClick={() => move(1)}
          >
            <CaretRight size={16} />
          </button>
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="salary-key" />
          Оклад
        </span>
        <span>
          <i className="bonus-key" />
          {mode === "plan" ? "Начисленные бонусы" : "Бонусы за проекты"}
        </span>
        {mode === "plan" && (
          <span>
            <i className="projected-key" />
            Бонусы в прогнозе
          </span>
        )}
        <span className="chart-unit">₽ / месяц</span>
      </div>
      <div className="income-chart">
        <div className="chart-axis">
          {[1, 0.5, 0].map((v) => (
            <span key={v}>{(ceiling * v) / 1000} тыс.</span>
          ))}
        </div>
        <div className="chart-plot">
          <div className="chart-grid">
            <i />
            <i />
            <i />
          </div>
          <div className="chart-columns">
            {values.map((v) => (
              <button
                key={v.month}
                className={`chart-column ${v.month === month ? "current" : ""}`}
                onClick={() => onMonth(v.month)}
                aria-pressed={v.month === month}
                aria-label={`${monthLabel(v.month)}: ${mode === "plan" ? "план" : "получено"} ${money(v.total)}; оклад ${money(v.salary)}, бонусы ${money(v.bonus)}${v.projectedBonus ? `, из них в прогнозе ${money(v.projectedBonus)}` : ""}`}
              >
                <span className="chart-tooltip">
                  {monthLabel(v.month)}
                  <strong>{money(v.total)}</strong>
                  {v.projectedBonus > 0 && (
                    <small>В прогнозе: {money(v.projectedBonus)}</small>
                  )}
                </span>
                <span
                  className="bar-stack"
                  style={{ height: `${(v.total / ceiling) * 100}%` }}
                  aria-hidden="true"
                >
                  <span
                    className="bar-projected"
                    style={{ flex: v.projectedBonus }}
                  />
                  <span
                    className="bar-bonus"
                    style={{ flex: round(v.bonus - v.projectedBonus) }}
                  />
                  <span className="bar-salary" style={{ flex: v.salary }} />
                </span>
                <span className="chart-month">
                  {new Intl.DateTimeFormat("ru-RU", { month: "short" })
                    .format(new Date(`${v.month}-01T12:00:00`))
                    .replace(".", "")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-summary" aria-live="polite" aria-atomic="true">
        <span>
          {monthLabel(selected.month)} · {mode === "plan" ? "План" : "Получено"}
        </span>
        <strong>{money(selected.total)}</strong>
        <button className="text-button" onClick={reset}>
          К текущему месяцу
        </button>
      </div>
      <p className="chart-note">
        {mode === "plan"
          ? `Включает оклад и бонусы на плановые даты.${selected.projectedBonus > 0 ? ` Из суммы выбранного месяца ${money(selected.projectedBonus)} — за незакрытые этапы.` : ""} Бонусы в прогнозе зависят от закрытия этапов.`
          : "Показаны фактические поступления. Для ожидаемого дохода выберите «План»."}
      </p>
    </section>
  );
}

export default function App() {
  const [initial] = useState(readInitial);
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [storageLocked, setStorageLocked] = useState(Boolean(initial.error));
  const [route, setRoute] = useState(
    window.location.hash.slice(1) || "overview",
  );
  const [month, setMonth] = useState(monthOf(today()));
  const [projectModal, setProjectModal] = useState<Project | "new" | null>(
    null,
  );
  const [stageModal, setStageModal] = useState<{
    project: Project;
    stage?: Stage;
  } | null>(null);
  const [paymentModal, setPaymentModal] = useState<Entry | null>(null);
  const [toast, setToast] = useState("");
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const lastDeleted = deletedItems.at(-1);
  const [hasLegacyBackup, setHasLegacyBackup] = useState(() => {
    try {
      return Boolean(localStorage.getItem(LEGACY_BACKUP_KEY));
    } catch {
      return false;
    }
  });
  const [currentDate, setCurrentDate] = useState(today);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [projectFilter, setProjectFilter] = useState("active");
  const [paymentTab, setPaymentTab] = useState("expected");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const refreshDate = () => setCurrentDate(today());
    const timer = window.setInterval(refreshDate, 60_000);
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);
  useEffect(() => {
    const listener = () => {
      setRoute(window.location.hash.slice(1) || "overview");
      setMenuOpen(false);
      setSearch("");
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    mainRef.current?.focus();
  }, [route]);
  useEffect(() => {
    if (storageLocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setStorageError("");
    } catch {
      setStorageError(
        "Изменения не удалось сохранить в браузере. Скачайте резервную копию, чтобы не потерять данные.",
      );
    }
  }, [data, storageLocked]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const view = route.split("/")[0];
  const selectedProject = data.projects.find(
    (p) => p.id === route.split("/")[1],
  );
  const monthEntries = entries(data, month);
  const ready = monthEntries.filter((e) => e.eligible);
  const forecast = sum(monthEntries.map((e) => e.amount));
  const received = sum(
    data.payments.filter((p) => monthOf(p.date) === month).map((p) => p.amount),
  );
  const toReceive = sum(ready.map((e) => remaining(data, e)));
  const pipeline = sum(
    monthEntries.filter((e) => !e.eligible).map((e) => e.amount),
  );
  const nextPayment = nextPaymentPlan(data, currentDate);
  const nextDate = nextPayment.date;
  const overdue = overdueEntries(data);
  const reminders = paymentReminders(data, currentDate);
  const reminderDate = reminders[0]?.date;
  const reminderAmount = sum(
    reminders
      .filter((e) => e.date === reminderDate)
      .map((e) => remaining(data, e)),
  );
  const reminderDays = reminderDate
    ? Math.round(
        (Date.parse(reminderDate) - Date.parse(currentDate)) / 86400000,
      )
    : 0;
  const listedEntries =
    paymentFilter === "overdue"
      ? overdue
      : monthEntries.filter(
          (e) =>
            paymentFilter === "all" ||
            (paymentFilter === "unpaid" &&
              e.eligible &&
              remaining(data, e) > 0) ||
            paymentFilter === e.type,
        );
  const recent = [...data.payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const projectList = data.projects.filter(
    (p) =>
      (projectFilter === "all" ||
        (projectFilter === "archive" ? p.archived : !p.archived)) &&
      `${p.name} ${p.client}`
        .toLocaleLowerCase("ru")
        .includes(deferredSearch.toLocaleLowerCase("ru")),
  );
  const notify = (message: string) => setToast(message);
  function deleteProject(project: Project) {
    const stageIds = new Set(project.stages.map((s) => s.id));
    setDeletedItems((items) => [
      ...items,
      {
        kind: "project",
        project,
        index: data.projects.findIndex((p) => p.id === project.id),
        payments: data.payments.filter((p) => stageIds.has(p.entryId)),
      },
    ]);
    setData((d) => removeProject(d, project.id));
    if (selectedProject?.id === project.id) navigate("projects");
  }
  function deletePayment(payment: Payment) {
    setDeletedItems((items) => [
      ...items,
      {
        kind: "payment",
        payment,
        index: data.payments.findIndex((p) => p.id === payment.id),
      },
    ]);
    setData((d) => ({
      ...d,
      payments: d.payments.filter((p) => p.id !== payment.id),
    }));
  }
  function undoDeletion() {
    const item = deletedItems.at(-1);
    if (!item) return;
    try {
      setData(restoreDeleted(data, item));
      setDeletedItems((items) => items.slice(0, -1));
      notify("Запись возвращена");
    } catch {
      notify(
        "Не удалось вернуть запись: связанные данные уже изменились. Отмените новую выплату и попробуйте снова.",
      );
    }
  }
  function updateProject(project: Project) {
    setData((d) => ({
      ...d,
      projects: d.projects.some((p) => p.id === project.id)
        ? d.projects.map((p) => (p.id === project.id ? project : p))
        : [...d.projects, project],
    }));
    setProjectModal(null);
    notify("Проект сохранён");
    navigate(`projects/${project.id}`);
  }
  function updateStage(stage: Stage) {
    if (!stageModal) return;
    setData((d) => ({
      ...d,
      projects: d.projects.map((p) =>
        p.id === stageModal.project.id
          ? {
              ...p,
              stages: p.stages.some((s) => s.id === stage.id)
                ? p.stages.map((s) => (s.id === stage.id ? stage : s))
                : [...p.stages, stage],
            }
          : p,
      ),
    }));
    setStageModal(null);
    notify(
      stage.status === "closed"
        ? "Этап закрыт, бонус добавлен к выплате"
        : "Этап сохранён",
    );
  }
  function exportBackup(original = false, beforeUpdate = false) {
    const content =
      original || beforeUpdate
        ? (localStorage.getItem(
            beforeUpdate ? LEGACY_BACKUP_KEY : STORAGE_KEY,
          ) ?? "{}")
        : JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `dolya-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Резервная копия скачана");
  }
  async function importBackup(file: File) {
    try {
      if (file.size > 5_000_000)
        throw new Error("Файл слишком большой. Максимум — 5 МБ.");
      const raw = await file.text();
      const imported = parseBackup(raw);
      setConfirmation({
        title: "Восстановить резервную копию?",
        description: `В копии ${imported.projects.length} проектов и ${imported.payments.length} поступлений. Текущие данные будут заменены. Перед этим можно отменить и скачать их копию.`,
        action: () => {
          setData(prepareData(imported, raw));
          setHasLegacyBackup(Boolean(localStorage.getItem(LEGACY_BACKUP_KEY)));
          setDeletedItems([]);
          setStorageLocked(false);
          setMonth(monthOf(today()));
          notify("Данные восстановлены");
        },
      });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const monthControl = (
    <div className="month-control">
      <button
        className="icon-button"
        aria-label="Предыдущий месяц"
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <CaretLeft size={16} />
      </button>
      <label>
        <CalendarBlank size={16} />
        <span>{monthLabel(month)}</span>
        <input
          aria-label="Выбрать месяц"
          type="month"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
      </label>
      <button
        className="icon-button"
        aria-label="Следующий месяц"
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <CaretRight size={16} />
      </button>
    </div>
  );
  function projectTable(list: Project[], compact = false) {
    return list.length ? (
      <div className="table-scroll">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Проект</th>
              <th className="numeric">Бюджет этапов</th>
              <th className="numeric">Моя доля</th>
              <th>Этапы</th>
              <th className="numeric">Получено</th>
              <th>
                <span className="sr-only">Действия с проектом</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, compact ? 4 : undefined).map((p) => {
              const budget = sum(p.stages.map((s) => s.amount));
              const total = sum(p.stages.map(bonus));
              const paid = sum(p.stages.map((s) => paidFor(data, s.id)));
              const closed = p.stages.filter(
                (s) => s.status === "closed",
              ).length;
              return (
                <tr key={p.id}>
                  <td>
                    <button
                      className="project-name"
                      onClick={() => navigate(`projects/${p.id}`)}
                    >
                      <Avatar project={p} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.client || "Клиент не указан"}</small>
                      </span>
                    </button>
                  </td>
                  <td className="numeric">{money(budget)}</td>
                  <td className="numeric">
                    {money(total)}
                    <small>
                      {p.stages.length
                        ? "по ставкам этапов"
                        : `${data.settings.rate}% по умолчанию`}
                    </small>
                  </td>
                  <td>
                    <div className="stage-meter">
                      <span>
                        {closed} из {p.stages.length} закрыто
                      </span>
                      <div>
                        {p.stages.map((s) => (
                          <i
                            key={s.id}
                            className={
                              s.status === "closed"
                                ? "done"
                                : s.status === "active"
                                  ? "working"
                                  : ""
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="numeric">{money(paid)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Открыть ${p.name}`}
                        onClick={() => navigate(`projects/${p.id}`)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                      <button
                        className="icon-button danger-button"
                        aria-label={`Удалить проект ${p.name}`}
                        title="Удалить проект вместе с этапами и поступлениями"
                        onClick={() => deleteProject(p)}
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Здесь будут ваши проекты"
        action={
          <button className="button" onClick={() => setProjectModal("new")}>
            <Plus size={16} />
            Добавить проект
          </button>
        }
      >
        Добавьте проект и разбейте его бюджет на этапы.
      </Empty>
    );
  }
  function entryStatus(e: Entry) {
    if (!e.eligible)
      return (
        <span className="badge neutral">
          <span />
          Планируется
        </span>
      );
    if (!remaining(data, e))
      return (
        <span className="badge success">
          <Check size={12} />
          Получено
        </span>
      );
    if (e.date < today())
      return (
        <span className="badge warning">
          <span />
          Ожидает получения
        </span>
      );
    return (
      <span className="badge neutral">
        <span />К выплате
      </span>
    );
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        К содержимому
      </a>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="brand" href="#overview" aria-label="Доля — обзор">
          <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
            <path d="M5 5h23L13 28H4l12-16H5z" fill="currentColor" />
            <circle cx="26" cy="25" r="3" fill="#7a9685" />
          </svg>
          <span>
            доля<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">PM</div>
          <div>
            <strong>{data.settings.name}</strong>
            <small>Личная CRM</small>
          </div>
        </div>
        <div className="nav-caption">Рабочее пространство</div>
        <nav aria-label="Основная навигация">
          {nav.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={view === n.id ? "active" : ""}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon
                size={19}
                weight={view === n.id ? "duotone" : "regular"}
              />
              {n.label}
              {n.id === "payments" && overdue.length > 0 && (
                <span
                  className="nav-count"
                  aria-label={`${overdue.length} ожидают получения`}
                >
                  {overdue.length}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="commission-note">
            <span className="commission-number">
              {data.settings.rate}
              <small>%</small>
            </span>
            <p>
              Ваша доля в каждом
              <br />
              закрытом этапе
            </p>
            <button
              onClick={() => navigate("settings")}
              aria-label="Настроить процент бонуса"
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <a
            className={`settings-link ${view === "settings" ? "active" : ""}`}
            href="#settings"
          >
            <GearSix size={19} />
            Настройки
          </a>
          <div className="profile">
            <span className="profile-avatar">Я</span>
            <div>
              <strong>Мои финансы</strong>
              <small>Только для меня</small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>
      <div className="mobile-header">
        <a href="#overview" className="brand">
          доля.
        </a>
        <button
          className="icon-button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <DotsThree size={26} />}
        </button>
      </div>
      {menuOpen && (
        <button
          className="nav-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="main-content"
      >
        <header className="topline">
          <span>
            Личное пространство <CaretRight size={12} />{" "}
            <strong>
              {view === "projects"
                ? "Проекты"
                : view === "payments"
                  ? "Выплаты"
                  : view === "settings"
                    ? "Настройки"
                    : "Обзор"}
            </strong>
          </span>
          <span className="save-status">
            <span />
            {storageError ? "Не сохранено" : "Сохранено в этом браузере"}
          </span>
        </header>
        {storageError && (
          <div className="error-banner" role="alert">
            <Info size={20} />
            <span>{storageError}</span>
            <button
              className="text-button"
              onClick={() => exportBackup(storageLocked)}
            >
              Скачать копию
            </button>
          </div>
        )}
        {reminderDate && (
          <section
            className="payment-reminder"
            aria-label="Напоминание о выплате"
          >
            <BellRinging size={24} aria-hidden="true" />
            <div aria-live="polite" aria-atomic="true">
              <strong>
                {reminderDays === 0
                  ? "Сегодня"
                  : reminderDays === 1
                    ? "Завтра"
                    : "Через 2 дня"}{" "}
                — выплата {money(reminderAmount)}
              </strong>
              <p>
                По плану {dateLabel(reminderDate, true)}. Проверьте поступление
                и отметьте получение в CRM.
              </p>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setMonth(monthOf(reminderDate));
                setPaymentTab("expected");
                setPaymentFilter("unpaid");
                navigate("payments");
              }}
            >
              Посмотреть выплаты <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        )}

        {view === "overview" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">Всё, что вы заработали</div>
                <h1>Обзор доходов</h1>
                <p>Ваши проекты, бонусы и выплаты — в одном месте.</p>
              </div>
              <div className="heading-actions">
                {monthControl}
                <button
                  className="button primary"
                  onClick={() => setProjectModal("new")}
                >
                  <Plus size={17} />
                  Новый проект
                </button>
              </div>
            </div>
            <section className="metrics" aria-label="Доходы за выбранный месяц">
              <div className="metric lead">
                <span>
                  План дохода{" "}
                  <Info
                    size={14}
                    aria-label="Оклад и бонусы всех этапов, ожидаемых в этом месяце"
                  />
                </span>
                <strong>{money(forecast)}</strong>
                <small>Оклад + все бонусы</small>
              </div>
              <div className="metric">
                <span>Получено</span>
                <strong>{money(received)}</strong>
                <small>
                  <span className="status-dot" />
                  Поступления за месяц
                </small>
              </div>
              <div className="metric">
                <span>Осталось получить</span>
                <strong>{money(toReceive)}</strong>
                <small>Закрытые этапы и оклад</small>
              </div>
              <div className="metric">
                <span>В работе и в планах</span>
                <strong>{money(pipeline)}</strong>
                <small>Бонусы незакрытых этапов</small>
              </div>
            </section>
            <div className="overview-grid">
              <section
                className="panel next-payment"
                aria-label="Ближайшая выплата"
              >
                <div className="section-header">
                  <h2>Ближайшая выплата</h2>
                  <span className="badge neutral">
                    <CalendarBlank size={12} />1 и 15 числа
                  </span>
                </div>
                <div className="next-payment-main">
                  <div>
                    <span className="subtle">
                      {nextDate
                        ? `${dateLabel(nextDate, true)} · ${Math.max(0, Math.round((Date.parse(nextDate) - Date.parse(currentDate)) / 86400000))} дн. до выплаты`
                        : "Всё получено"}
                    </span>
                    <strong className="next-amount">
                      {money(nextPayment.amount)}
                    </strong>
                    {nextPayment.projectedBonus > 0 && (
                      <small className="next-forecast-caption">
                        План с учётом незакрытых этапов
                      </small>
                    )}
                  </div>
                  <span className="payment-arrow">
                    <ArrowDownLeft size={27} weight="light" />
                  </span>
                </div>
                <div className="payday-track">
                  {["01", "15"].map((day) => {
                    const payoutMonth = monthOf(nextDate ?? currentDate);
                    const date = `${payoutMonth}-${day}`;
                    const payEntries = entries(data, payoutMonth).filter(
                      (e) => e.date === date,
                    );
                    const complete =
                      payEntries.length > 0 &&
                      payEntries.every((e) => remaining(data, e) === 0);
                    return (
                      <div
                        key={day}
                        className={
                          complete
                            ? "complete"
                            : nextDate === date
                              ? "next"
                              : ""
                        }
                      >
                        <span className="payday-dot">
                          {complete ? <Check size={12} /> : <span />}
                        </span>
                        <span>{dateLabel(date, true)}</span>
                        <small>{complete ? "Получено" : "Выплата"}</small>
                      </div>
                    );
                  })}
                  <i />
                </div>
                <div className="next-breakdown">
                  <div>
                    <span>Фиксированная часть</span>
                    <strong>{money(nextPayment.salary)}</strong>
                  </div>
                  <div>
                    <span>Бонусы за этапы</span>
                    <strong>{money(nextPayment.bonus)}</strong>
                  </div>
                  {nextPayment.projectedBonus > 0 && (
                    <p className="next-forecast-note">
                      <Info size={16} aria-hidden="true" />
                      <span>
                        Из бонусов {money(nextPayment.projectedBonus)} — прогноз
                        по незакрытым этапам. Эти деньги станут доступны после
                        закрытия этапов.
                      </span>
                    </p>
                  )}
                </div>
                <button
                  className="panel-footer-button"
                  onClick={() => {
                    setMonth(
                      nextDate ? monthOf(nextDate) : monthOf(currentDate),
                    );
                    setPaymentTab("expected");
                    setPaymentFilter("all");
                    navigate("payments");
                  }}
                >
                  Посмотреть состав выплаты
                  <ArrowRight size={16} />
                </button>
              </section>
              <IncomeChart
                data={data}
                month={month}
                currentMonth={monthOf(currentDate)}
                onMonth={setMonth}
              />
            </div>
            {overdue.length > 0 && (
              <button
                className="attention-strip"
                onClick={() => {
                  setPaymentTab("expected");
                  setPaymentFilter("overdue");
                  navigate("payments");
                }}
              >
                <Info size={19} />
                <span>
                  <strong>
                    {money(sum(overdue.map((e) => remaining(data, e))))} ожидают
                    получения
                  </strong>
                  <span>
                    Плановая дата выплаты уже прошла. Отметьте поступление, если
                    деньги пришли.
                  </span>
                </span>
                <ArrowRight size={18} />
              </button>
            )}
            <div className="lower-grid">
              <section className="panel project-panel">
                <div className="section-header">
                  <h2>
                    Мои проекты{" "}
                    <span className="count">
                      {data.projects.filter((p) => !p.archived).length}
                    </span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => navigate("projects")}
                  >
                    Все проекты
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {projectTable(
                  data.projects.filter((p) => !p.archived),
                  true,
                )}
              </section>
              <section className="panel recent-panel">
                <div className="section-header">
                  <h2>Последние поступления</h2>
                  <ArrowDownLeft size={19} className="muted" />
                </div>
                {recent.length ? (
                  <div className="recent-list">
                    {recent.map((p) => {
                      const e = findEntry(data, p.entryId);
                      return (
                        <div className="recent-row" key={p.id}>
                          <span className="recent-icon">
                            <ArrowDownLeft size={17} />
                          </span>
                          <div>
                            <strong>
                              {e?.type === "salary"
                                ? "Фиксированная часть"
                                : e?.title || "Поступление"}
                            </strong>
                            <small>
                              {dateLabel(p.date)} ·{" "}
                              {e?.type === "salary" ? "Оклад" : "Бонус за этап"}
                            </small>
                          </div>
                          <span className="recent-amount">
                            +{money(p.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="quiet-empty">
                    Здесь появится история, когда вы отметите первую полученную
                    выплату.
                  </div>
                )}
                <button
                  className="panel-footer-button"
                  onClick={() => {
                    setPaymentTab("history");
                    navigate("payments");
                  }}
                >
                  История выплат
                  <ArrowRight size={16} />
                </button>
              </section>
            </div>
            <div className="page-footnote">
              <ShieldCheck size={15} />
              Личные финансы без лишнего шума.
              <span>
                Данные хранятся в вашем браузере ·{" "}
                <button onClick={() => exportBackup()}>Скачать копию</button>
              </span>
            </div>
          </>
        )}

        {view === "projects" && !selectedProject && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">От бюджета до вашего бонуса</div>
                <h1>Мои проекты</h1>
                <p>Разбивайте проекты на этапы и отслеживайте свою долю.</p>
              </div>
              <button
                className="button primary"
                onClick={() => setProjectModal("new")}
              >
                <Plus size={17} />
                Новый проект
              </button>
            </div>
            <div className="list-toolbar">
              <div className="tabs">
                {[
                  ["active", "Активные"],
                  ["archive", "Архив"],
                  ["all", "Все проекты"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={projectFilter === value ? "active" : ""}
                    onClick={() => setProjectFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="search-input">
                <MagnifyingGlass size={17} />
                <input
                  aria-label="Поиск проектов"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти проект или клиента"
                />
              </label>
            </div>
            <section className="panel">
              <div className="section-header">
                <h2>
                  {projectList.length}{" "}
                  {projectList.length === 1 ? "проект" : "проектов"}
                </h2>
                <span className="subtle">Суммы по всем этапам проекта</span>
              </div>
              {projectList.length ? (
                projectTable(projectList)
              ) : (
                <Empty
                  title={
                    search
                      ? "Проекты не найдены"
                      : projectFilter === "archive"
                        ? "В архиве пока пусто"
                        : "Добавим первый проект?"
                  }
                  action={
                    projectFilter !== "archive" && !search ? (
                      <button
                        className="button primary"
                        onClick={() => setProjectModal("new")}
                      >
                        <Plus size={16} />
                        Добавить проект
                      </button>
                    ) : undefined
                  }
                >
                  {search
                    ? "Попробуйте другое название или имя клиента."
                    : "Все бюджеты и этапы будут собраны здесь."}
                </Empty>
              )}
            </section>
          </>
        )}

        {view === "projects" && selectedProject && (
          <>
            <button
              className="back-button"
              onClick={() => navigate("projects")}
            >
              <ArrowLeft size={16} />
              Все проекты
            </button>
            <div className="page-heading project-heading">
              <div className="project-title">
                <Avatar project={selectedProject} />
                <div>
                  <div className="eyebrow">
                    {selectedProject.client || "Мой проект"}
                    {selectedProject.archived && " · В архиве"}
                  </div>
                  <h1>{selectedProject.name}</h1>
                </div>
              </div>
              <div className="heading-actions">
                <button
                  className="button"
                  onClick={() => setProjectModal(selectedProject)}
                >
                  <PencilSimple size={16} />
                  Редактировать
                </button>
                <button
                  className="button danger-button"
                  aria-label={`Удалить проект ${selectedProject.name}`}
                  title="Удалить проект вместе с этапами и поступлениями"
                  onClick={() => deleteProject(selectedProject)}
                >
                  <Trash size={16} />
                  Удалить проект
                </button>
                <button
                  className="button primary"
                  onClick={() => setStageModal({ project: selectedProject })}
                >
                  <Plus size={16} />
                  Добавить этап
                </button>
              </div>
            </div>
            <div className="project-meta">
              {selectedProject.sheetUrl ? (
                <a
                  href={selectedProject.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={17} />
                  Открыть бюджет в Google Таблицах
                  <ArrowSquareOut size={15} />
                </a>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setProjectModal(selectedProject)}
                >
                  <Plus size={15} />
                  Прикрепить Google-таблицу
                </button>
              )}
              <span>Бонус начисляется после закрытия этапа</span>
            </div>
            {selectedProject.note && (
              <p className="project-note">{selectedProject.note}</p>
            )}
            <section className="metrics project-metrics">
              <div className="metric lead">
                <span>Бюджет проекта</span>
                <strong>
                  {money(sum(selectedProject.stages.map((s) => s.amount)))}
                </strong>
                <small>Сумма бюджетов всех этапов</small>
              </div>
              <div className="metric">
                <span>Моя доля за проект</span>
                <strong>{money(sum(selectedProject.stages.map(bonus)))}</strong>
                <small>По ставке каждого этапа</small>
              </div>
              <div className="metric">
                <span>Получено бонусов</span>
                <strong>
                  {money(
                    sum(selectedProject.stages.map((s) => paidFor(data, s.id))),
                  )}
                </strong>
                <small>Фактические поступления</small>
              </div>
            </section>
            <section className="panel">
              <div className="section-header">
                <h2>
                  Этапы проекта{" "}
                  <span className="count">{selectedProject.stages.length}</span>
                </h2>
                <span className="subtle">
                  Закройте этап, чтобы начислить бонус
                </span>
              </div>
              {selectedProject.stages.length ? (
                <div className="table-scroll">
                  <table className="stages-table">
                    <thead>
                      <tr>
                        <th>Этап</th>
                        <th className="numeric">Бюджет</th>
                        <th className="numeric">Мой бонус</th>
                        <th>Статус</th>
                        <th>Дата выплаты</th>
                        <th>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProject.stages.map((s, i) => {
                        const e = findEntry(data, s.id)!;
                        const paid = paidFor(data, s.id);
                        return (
                          <tr key={s.id}>
                            <td>
                              <span className="stage-name">
                                <span className="stage-index">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span>
                                  <strong>{s.name}</strong>
                                  <small>
                                    Плановое закрытие: {dateLabel(s.dueDate)}
                                  </small>
                                </span>
                              </span>
                            </td>
                            <td className="numeric">{money(s.amount)}</td>
                            <td className="numeric">
                              {money(bonus(s))}
                              <small>{s.rate}% от бюджета</small>
                            </td>
                            <td>
                              <span
                                className={`badge ${s.status === "closed" ? "success" : "neutral"}`}
                              >
                                {s.status === "closed" ? (
                                  <Check size={12} />
                                ) : (
                                  <span />
                                )}
                                {statusLabels[s.status]}
                              </span>
                            </td>
                            <td>
                              {dateLabel(e.date)}
                              <small>
                                {e.eligible
                                  ? paid
                                    ? `Получено ${money(paid)}`
                                    : "Бонус начислен"
                                  : "Предварительно"}
                              </small>
                            </td>
                            <td>
                              <div className="row-actions">
                                {s.status !== "closed" ? (
                                  <button
                                    className="button compact"
                                    onClick={() =>
                                      setStageModal({
                                        project: selectedProject,
                                        stage: {
                                          ...s,
                                          status: "closed",
                                          closedDate: today(),
                                        },
                                      })
                                    }
                                  >
                                    Закрыть этап
                                    <Check size={14} />
                                  </button>
                                ) : remaining(data, e) > 0 ? (
                                  <button
                                    className="button compact"
                                    onClick={() => setPaymentModal(e)}
                                  >
                                    Получить
                                    <ArrowDownLeft size={14} />
                                  </button>
                                ) : (
                                  <span className="received-label">
                                    <CheckCircle size={16} />
                                    Получено
                                  </span>
                                )}
                                {!paid && (
                                  <>
                                    <button
                                      className="icon-button"
                                      aria-label={`Редактировать этап ${s.name}`}
                                      onClick={() =>
                                        setStageModal({
                                          project: selectedProject,
                                          stage: s,
                                        })
                                      }
                                    >
                                      <PencilSimple size={16} />
                                    </button>
                                    <button
                                      className="icon-button"
                                      aria-label={`Удалить этап ${s.name}`}
                                      onClick={() =>
                                        setConfirmation({
                                          title: `Удалить этап «${s.name}»?`,
                                          description:
                                            "Бюджет и бонус этого этапа будут исключены из проекта. Полученных выплат у этапа нет.",
                                          action: () => {
                                            setData((d) => ({
                                              ...d,
                                              projects: d.projects.map((p) =>
                                                p.id === selectedProject.id
                                                  ? {
                                                      ...p,
                                                      stages: p.stages.filter(
                                                        (stage) =>
                                                          stage.id !== s.id,
                                                      ),
                                                    }
                                                  : p,
                                              ),
                                            }));
                                            notify("Этап удалён");
                                          },
                                        })
                                      }
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Из каких этапов состоит проект?"
                  action={
                    <button
                      className="button"
                      onClick={() =>
                        setStageModal({ project: selectedProject })
                      }
                    >
                      <Plus size={16} />
                      Добавить первый этап
                    </button>
                  }
                >
                  Укажите бюджет этапа — ваша доля посчитается автоматически.
                </Empty>
              )}
            </section>
            <div className="project-footer">
              <p>
                <Info size={16} />
                Этапы с полученными выплатами защищены от изменения. Сначала
                отмените поступление в истории выплат.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  setConfirmation({
                    title: selectedProject.archived
                      ? "Вернуть проект в работу?"
                      : "Перенести проект в архив?",
                    description:
                      "Этапы, бонусы и история выплат сохранятся. Архивные проекты доступны во вкладке «Архив».",
                    action: () => {
                      updateProject({
                        ...selectedProject,
                        archived: !selectedProject.archived,
                      });
                    },
                  })
                }
              >
                {selectedProject.archived ? "Вернуть в работу" : "В архив"}
                <FolderSimple size={16} />
              </button>
            </div>
          </>
        )}

        {view === "payments" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">От начисления до поступления</div>
                <h1>Мои выплаты</h1>
                <p>
                  Учитывайте оклад и бонусы, отмечайте фактически полученные
                  деньги.
                </p>
              </div>
              {monthControl}
            </div>
            <section className="metrics project-metrics">
              <div className="metric lead">
                <span>Получено за месяц</span>
                <strong>{money(received)}</strong>
                <small>По дате фактического поступления</small>
              </div>
              <div className="metric">
                <span>Осталось получить</span>
                <strong>{money(toReceive)}</strong>
                <small>Из начисленного за выбранный месяц</small>
              </div>
              <div className="metric">
                <span>Планируемые бонусы</span>
                <strong>{money(pipeline)}</strong>
                <small>Этапы ещё не закрыты</small>
              </div>
            </section>
            <div className="list-toolbar">
              <div className="tabs">
                <button
                  className={paymentTab === "expected" ? "active" : ""}
                  onClick={() => setPaymentTab("expected")}
                >
                  План выплат
                </button>
                <button
                  className={paymentTab === "history" ? "active" : ""}
                  onClick={() => setPaymentTab("history")}
                >
                  История поступлений
                </button>
              </div>
              {paymentTab === "expected" && (
                <select
                  aria-label="Фильтр выплат"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="all">Все выплаты</option>
                  <option value="unpaid">Осталось получить за месяц</option>
                  <option value="overdue">Просроченные за всё время</option>
                  <option value="bonus">Только бонусы</option>
                  <option value="salary">Только оклад</option>
                </select>
              )}
            </div>
            <section className="panel">
              {paymentTab === "expected" ? (
                <>
                  <div className="section-header">
                    <h2>
                      {paymentFilter === "overdue"
                        ? "Ожидают получения · все месяцы"
                        : `План на ${monthLabel(month).toLocaleLowerCase("ru")}`}
                    </h2>
                    <span className="subtle">1 и 15 числа</span>
                  </div>
                  {listedEntries.length ? (
                    <div className="table-scroll">
                      <table className="payments-table">
                        <thead>
                          <tr>
                            <th>Источник</th>
                            <th>Плановая дата</th>
                            <th className="numeric">Начислено / план</th>
                            <th className="numeric">Остаток</th>
                            <th>Статус</th>
                            <th>Действие</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listedEntries.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <div className="payment-source">
                                  {e.type === "salary" ? (
                                    <span className="salary-avatar">
                                      <Wallet size={19} />
                                    </span>
                                  ) : (
                                    <Avatar
                                      project={{
                                        code: e.code!,
                                        color: e.color!,
                                      }}
                                    />
                                  )}
                                  <span>
                                    <strong>{e.title}</strong>
                                    <small>{e.subtitle}</small>
                                  </span>
                                </div>
                              </td>
                              <td>
                                {dateLabel(e.date, true)}
                                {paymentFilter === "overdue" &&
                                  ` ${e.date.slice(0, 4)}`}
                              </td>
                              <td className="numeric">{money(e.amount)}</td>
                              <td className="numeric">
                                {money(remaining(data, e))}
                              </td>
                              <td>{entryStatus(e)}</td>
                              <td>
                                {e.eligible && remaining(data, e) > 0 ? (
                                  <button
                                    className="button compact"
                                    onClick={() => setPaymentModal(e)}
                                  >
                                    Отметить получение
                                    <ArrowDownLeft size={14} />
                                  </button>
                                ) : !e.eligible ? (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      navigate(`projects/${e.projectId}`)
                                    }
                                  >
                                    К этапу
                                    <ArrowUpRight size={14} />
                                  </button>
                                ) : (
                                  <CheckCircle size={19} className="positive" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="Здесь всё спокойно">
                      {paymentFilter === "overdue"
                        ? "Все выплаты с прошедшей плановой датой уже получены."
                        : "За выбранный месяц выплат с таким фильтром нет."}
                    </Empty>
                  )}
                  <div className="table-note">
                    <Info size={15} />
                    Планируемые бонусы станут доступны к получению после
                    закрытия этапов.
                  </div>
                </>
              ) : (
                <>
                  <div className="section-header">
                    <h2>Полученные деньги</h2>
                    <span className="subtle">По фактической дате</span>
                  </div>
                  {data.payments.some((p) => monthOf(p.date) === month) ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Источник</th>
                            <th>Дата получения</th>
                            <th>Комментарий</th>
                            <th className="numeric">Сумма</th>
                            <th>
                              <span className="sr-only">Удаление выплаты</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.payments]
                            .filter((p) => monthOf(p.date) === month)
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((p) => {
                              const e = findEntry(data, p.entryId);
                              return (
                                <tr key={p.id}>
                                  <td>
                                    <strong>{e?.title}</strong>
                                    <small>{e?.subtitle}</small>
                                  </td>
                                  <td>{dateLabel(p.date, true)}</td>
                                  <td className="muted">{p.note || "—"}</td>
                                  <td className="numeric positive">
                                    +{money(p.amount)}
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button danger-button"
                                      aria-label={`Удалить выплату ${money(p.amount)}`}
                                      title="Удалить выплату — сумма вернётся в остаток"
                                      onClick={() => deletePayment(p)}
                                    >
                                      <Trash size={17} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="Поступлений пока нет">
                      Отметьте получение в плане выплат. Каждая выплата появится
                      здесь с датой и суммой.
                    </Empty>
                  )}
                </>
              )}
            </section>
          </>
        )}

        {view === "settings" && (
          <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">Под ваш рабочий ритм</div>
                <h1>Настройки</h1>
                <p>Условия оплаты и сохранность ваших данных.</p>
              </div>
            </div>
            <SettingsView
              data={data}
              onSave={(d) => {
                setData(d);
                notify("Настройки сохранены");
              }}
            />
            <div className="settings-section">
              <div>
                <h2>Резервная копия</h2>
                <p>
                  Данные хранятся только в этом браузере. Скачивайте копию,
                  чтобы перенести их на другой компьютер или восстановить после
                  очистки браузера.
                </p>
              </div>
              <div className="settings-card">
                <div className="backup-illustration">
                  <ShieldCheck size={27} />
                  <div>
                    <strong>Ваши данные принадлежат вам</strong>
                    <p>Проекты, этапы и история выплат в одном JSON-файле.</p>
                  </div>
                </div>
                <div className="backup-actions">
                  <button className="button" onClick={() => exportBackup()}>
                    <DownloadSimple size={17} />
                    Скачать копию
                  </button>
                  <button
                    className="button"
                    onClick={() => fileRef.current?.click()}
                  >
                    <UploadSimple size={17} />
                    Восстановить
                  </button>
                  {hasLegacyBackup && (
                    <button
                      className="button"
                      onClick={() => exportBackup(false, true)}
                    >
                      <DownloadSimple size={17} />
                      Копия до обновления
                    </button>
                  )}
                </div>
                <input
                  hidden
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importBackup(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="settings-section">
              <div>
                <h2>Как считается доход</h2>
                <p>Прозрачные правила без скрытых вычислений.</p>
              </div>
              <div className="settings-card rules-list">
                <div>
                  <span>01</span>
                  <p>
                    <strong>Оклад — дважды в месяц</strong>Первая часть 1-го,
                    вторая 15-го числа. Факт получения отмечается вручную.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>Бонус — за закрытый этап</strong>Бюджет этапа × ваша
                    ставка. Плановая выплата — ближайшее 1-е или 15-е, включая
                    день закрытия.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Google Таблицы — по ссылке</strong>Прикрепите бюджет
                    к проекту. Этапы и суммы пока вносятся вручную.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        {!["overview", "projects", "payments", "settings"].includes(view) && (
          <Empty
            title="Страница не найдена"
            action={
              <button className="button" onClick={() => navigate("overview")}>
                Перейти к обзору
              </button>
            }
          >
            Откройте нужный раздел в меню.
          </Empty>
        )}
      </main>
      {projectModal && (
        <ProjectForm
          existing={projectModal === "new" ? undefined : projectModal}
          onSave={updateProject}
          onClose={() => setProjectModal(null)}
        />
      )}
      {stageModal && (
        <StageForm
          project={stageModal.project}
          existing={stageModal.stage}
          rate={data.settings.rate}
          onSave={updateStage}
          onClose={() => setStageModal(null)}
        />
      )}
      {paymentModal && (
        <PaymentForm
          data={data}
          entry={paymentModal}
          onSave={(d) => {
            setData(d);
            setPaymentModal(null);
            notify("Получение записано. Доход обновлён.");
          }}
          onClose={() => setPaymentModal(null)}
        />
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="confirm-description">{confirmation.description}</p>
          <div className="form-footer">
            <button className="button" onClick={() => setConfirmation(null)}>
              Отмена
            </button>
            <button
              className="button primary"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Подтвердить
            </button>
          </div>
        </Modal>
      )}
      {lastDeleted && (
        <div
          className="undo-notice"
          role="region"
          aria-label="Удалённые записи"
        >
          <span role="status" aria-live="polite" aria-atomic="true">
            {lastDeleted.kind === "project"
              ? `Проект «${lastDeleted.project.name}» удалён вместе с этапами и поступлениями.`
              : `Выплата ${money(lastDeleted.payment.amount)} удалена. Остаток пересчитан.`}
          </span>
          <button className="text-button" onClick={undoDeletion}>
            <ArrowCounterClockwise size={17} aria-hidden="true" />
            Вернуть
          </button>
          <button
            className="icon-button"
            aria-label="Закрыть сообщение об удалении"
            onClick={() => setDeletedItems([])}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div
        className={`toast ${toast ? "visible" : ""} ${deletedItems.length ? "above-undo" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <CheckCircle size={20} />
            <span>{toast}</span>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsView({
  data,
  onSave,
}: {
  data: Data;
  onSave: (d: Data) => void;
}) {
  const current = monthOf(today());
  const plan =
    [...data.settings.salaryPlans]
      .sort((a, b) => b.from.localeCompare(a.from))
      .find((p) => p.from <= current) ?? data.settings.salaryPlans[0];
  const [name, setName] = useState(data.settings.name);
  const [rate, setRate] = useState(String(data.settings.rate));
  const [first, setFirst] = useState(String(plan.first));
  const [second, setSecond] = useState(String(plan.second));
  const [effectiveMonth, setEffectiveMonth] = useState(shiftMonth(current, 1));
  const [salaryError, setSalaryError] = useState("");
  return (
    <>
      <div className="settings-section">
        <div>
          <h2>Личное пространство</h2>
          <p>
            Название и ставка для новых этапов. Ставки уже созданных этапов
            сохранятся.
          </p>
        </div>
        <form
          className="settings-card form"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              ...data,
              settings: {
                ...data.settings,
                name: name.trim(),
                rate: Number(rate),
              },
            });
          }}
        >
          <label>
            Название пространства
            <input
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Бонус по умолчанию, %
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <div className="bonus-preview">
            <span>При бюджете этапа 100 000 ₽</span>
            <strong>{money(1000 * (Number(rate) || 0))}</strong>
          </div>
          <button className="button primary" disabled={!name.trim()}>
            Сохранить настройки
            <Check size={16} />
          </button>
        </form>
      </div>
      <div className="settings-section">
        <div>
          <h2>Фиксированная часть</h2>
          <p>
            Сейчас {money(plan.first + plan.second)} в месяц. Изменения
            действуют с будущего месяца и сохраняют историю уже начисленных
            выплат.
          </p>
        </div>
        <form
          className="settings-card form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              data.payments.some(
                (payment) =>
                  payment.entryId.startsWith("salary-") &&
                  payment.entryId.slice(7, 14) >= effectiveMonth,
              )
            ) {
              setSalaryError(
                "На этот или последующие месяцы уже записаны поступления оклада. Сначала отмените их в истории выплат или выберите более поздний месяц.",
              );
              return;
            }
            setSalaryError("");
            onSave({
              ...data,
              settings: {
                ...data.settings,
                salaryPlans: [
                  ...data.settings.salaryPlans.filter(
                    (p) => p.from !== effectiveMonth,
                  ),
                  {
                    from: effectiveMonth,
                    first: Number(first),
                    second: Number(second),
                  },
                ],
              },
            });
          }}
        >
          <div className="form-grid">
            <label>
              1-го числа, ₽
              <input
                required
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />
            </label>
            <label>
              15-го числа, ₽
              <input
                required
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                value={second}
                onChange={(e) => setSecond(e.target.value)}
              />
            </label>
          </div>
          <label>
            Применить с месяца
            <input
              required
              type="month"
              min={shiftMonth(current, 1)}
              value={effectiveMonth}
              onChange={(e) => setEffectiveMonth(e.target.value)}
            />
          </label>
          <div className="bonus-preview">
            <span>Всего в месяц</span>
            <strong>
              {money((Number(first) || 0) + (Number(second) || 0))}
            </strong>
          </div>
          {data.settings.salaryPlans
            .filter((p) => p.from > current)
            .map((p) => (
              <p key={p.from} className="field-hint">
                С {monthLabel(p.from).toLocaleLowerCase("ru")}: {money(p.first)}{" "}
                + {money(p.second)}
              </p>
            ))}
          {salaryError && (
            <p className="form-error" role="alert">
              {salaryError}
            </p>
          )}
          <button className="button primary">
            Сохранить условия
            <Check size={16} />
          </button>
        </form>
      </div>
    </>
  );
}
