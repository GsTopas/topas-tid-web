import type { NormDay } from "../../lib/api";
import { defaultTimeOut } from "./time";

/** Forslag til mødt/gået/frokost for en dag uden registrering. */
export type DayDefaults = { time_in: string; time_out: string; lunch_min: number };

/**
 * Forudfyldning af en tom dag: normugens tider for ugedagen, hvis den er sat;
 * ellers som før (08:00, 08:00 + normtid + ½ time, 30 min frokost).
 */
export const dayDefaults = (normDay: NormDay | null | undefined, normHours: number): DayDefaults =>
  normDay
    ? { time_in: normDay.time_in, time_out: normDay.time_out, lunch_min: normDay.lunch_min }
    : { time_in: "08:00", time_out: defaultTimeOut(normHours), lunch_min: 30 };
