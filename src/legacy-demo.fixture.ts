import {
  COLORS,
  emptyData,
  entries,
  id,
  monthOf,
  shiftMonth,
  today,
} from "./domain";
import type { Data, Stage, StageStatus } from "./domain";

export function demoData(): Data {
  const data = emptyData();
  data.demo = true;
  const month = monthOf(today());
  data.settings.startMonth = shiftMonth(month, -5);
  data.settings.salaryPlans[0].from = data.settings.startMonth;
  const makeStage = (
    name: string,
    amount: number,
    day: number,
    status: StageStatus,
    offset = 0,
  ): Stage => {
    const m = shiftMonth(month, offset);
    const last = new Date(`${shiftMonth(m, 1)}-01T12:00:00`);
    last.setDate(0);
    const date = `${m}-${String(Math.min(day, last.getDate())).padStart(2, "0")}`;
    return {
      id: id(),
      name,
      amount,
      rate: 7,
      dueDate: date,
      status,
      closedDate: status === "closed" ? date : "",
    };
  };
  data.projects = [
    {
      id: id(),
      name: "Сайт для «Архитек»",
      client: "Архитек · архитектурное бюро",
      code: "Ар",
      color: COLORS[0],
      sheetUrl: "",
      note: "Корпоративный сайт и каталог проектов. Бонус — после приёмки каждого этапа.",
      archived: false,
      stages: [
        makeStage("Исследование и прототип", 120000, 12, "closed", -1),
        makeStage("Дизайн-концепция", 180000, 27, "closed", -1),
        makeStage("Разработка и запуск", 240000, 12, "active"),
      ],
    },
    {
      id: id(),
      name: "Личный кабинет Модуль",
      client: "Модуль · сервис для бизнеса",
      code: "М",
      color: COLORS[1],
      sheetUrl: "",
      note: "",
      archived: false,
      stages: [
        makeStage("Аналитика и сценарии", 150000, 28, "closed", -1),
        makeStage("Проектирование интерфейса", 200000, 14, "active"),
        makeStage("Передача в разработку", 160000, 25, "planned"),
      ],
    },
    {
      id: id(),
      name: "Интернет-магазин Botanica",
      client: "Botanica · растения и декор",
      code: "B",
      color: COLORS[2],
      sheetUrl: "",
      note: "",
      archived: false,
      stages: [
        makeStage("Структура и прототип", 80000, 10, "closed", -1),
        makeStage("Дизайн магазина", 140000, 30, "closed", -1),
        makeStage("Сборка и интеграции", 220000, 20, "active"),
      ],
    },
    {
      id: id(),
      name: "Бренд-платформа Точка",
      client: "Точка · кофейня",
      code: "Т",
      color: COLORS[3],
      sheetUrl: "",
      note: "",
      archived: false,
      stages: [
        makeStage("Исследование бренда", 90000, 8, "active"),
        makeStage("Визуальная система", 130000, 24, "planned"),
      ],
    },
  ];
  // Every total and chart is derived from these records, including the demo.
  for (let i = -5; i <= 0; i++) {
    const m = shiftMonth(month, i);
    for (const day of ["01", "15"]) {
      const date = `${m}-${day}`;
      if (date <= today())
        data.payments.push({
          id: id(),
          entryId: `salary-${date}`,
          amount: 20000,
          date,
          note: "",
        });
    }
  }
  for (const e of entries(data, shiftMonth(month, -1)).filter(
    (e) => e.type === "bonus" && e.eligible,
  ))
    data.payments.push({
      id: id(),
      entryId: e.id,
      amount: e.amount,
      date: e.date,
      note: "",
    });
  return data;
}
