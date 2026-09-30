import type { api } from "../../lib/api";

export type ProxyEmployee = Awaited<ReturnType<typeof api.proxyEmployees>>[number];
export type PeriodDayEntry = Awaited<ReturnType<typeof api.periodDays>>["entries"][number];
export type DayPayload = Parameters<typeof api.saveDay>[0];

/** Kalenderstatus pr. dato: gemt dagsregistrering + sum af fordelte timer. */
export type DayStatusMap = Record<string, { entry: PeriodDayEntry | null; alloc: number }>;

export type WeeklyNorm = Record<number, number | string | null | undefined>;

export type AllocLine = {
  company_id: number | string;
  task_type: string;
  hours: string;
  task_note: string;
};

/** Formularens tilstand for den valgte dag (tal som danske strenge, fx "7,5"). */
export type DayFormState = {
  day_type: string;
  extra_abs: string;
  absence_choice: string;
  location_note: string;
  absence_note: string;
  absence_hours: string;
  time_in: string;
  time_out: string;
  lunch_min: number;
  work_hours: string;
  note: string;
  allocations: AllocLine[];
};
