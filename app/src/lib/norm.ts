import { weekdayIdx } from "./format";

type Norm = Record<number, number | string | null | undefined> | null | undefined;

/** Dagsfordeling fra normugen (norm_split), gældende fra valid_from. */
export interface NormSplit {
  employee_id: number;
  valid_from: string;
  weekly_norm: number[];
}

/** Ugesum af en dagsfordeling (index 0..6). */
export const weekSum = (norm: Norm): number => {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(norm?.[i] || 0);
  }
  return sum;
};

/** Dagsfordelingen der gælder på `date`: den seneste fra normugen, hvis ugesummen er lig kontraktens; ellers null. */
export const activeSplit = (contract: Norm, splits: NormSplit[] | null | undefined, date: string): NormSplit | null => {
  let best: NormSplit | null = null;
  for (const s of splits || []) {
    if (s.valid_from <= date && (!best || s.valid_from > best.valid_from)) {
      best = s;
    }
  }
  return best && Math.abs(weekSum(best.weekly_norm) - weekSum(contract)) < 0.01 ? best : null;
};

/**
 * Dagens normtimer: normugens dagsfordeling når den gælder (samme ugesum som kontrakten),
 * ellers kontraktens (employees.weekly_norm).
 */
export const dayNorm = (contract: Norm, splits: NormSplit[] | null | undefined, date: string): number => {
  const split = activeSplit(contract, splits, date);
  return Number((split ? split.weekly_norm : contract)?.[weekdayIdx(date)] || 0);
};

/** Fordelinger grupperet pr. medarbejder. */
export const splitsByEmployee = (splits: NormSplit[]): Record<number, NormSplit[]> => {
  const out: Record<number, NormSplit[]> = {};
  for (const s of splits) {
    (out[s.employee_id] = out[s.employee_id] || []).push(s);
  }
  return out;
};
