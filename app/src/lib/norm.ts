import { weekdayIdx } from "./format";

type Norm = Record<number, number | string | null | undefined> | null | undefined;

/**
 * Dagsfordeling gældende fra valid_from: fra normugen (norm_split), eller med `contract`
 * en normtid fra Medarbejdere (norm_contract), som gælder fra starten af en lønperiode.
 */
export interface NormSplit {
  employee_id: number;
  valid_from: string;
  weekly_norm: number[];
  /** true = kontraktens normtid (norm_contract), ellers normugens fordeling. */
  contract?: boolean;
}

const latest = (list: NormSplit[] | null | undefined, date: string, contract: boolean): NormSplit | null => {
  let best: NormSplit | null = null;
  for (const s of list || []) {
    if (!!s.contract === contract && s.valid_from <= date && (!best || s.valid_from > best.valid_from)) {
      best = s;
    }
  }
  return best;
};

/**
 * Kontraktens normtid på `date`: den seneste normtid fra Medarbejdere (norm_contract) med
 * valid_from ≤ date; findes ingen, employees.weekly_norm (`contract`).
 */
export const contractAt = (contract: Norm, splits: NormSplit[] | null | undefined, date: string): Norm => {
  const c = latest(splits, date, true);
  return c ? c.weekly_norm : contract;
};

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
  const best = latest(splits, date, false);
  return best && Math.abs(weekSum(best.weekly_norm) - weekSum(contractAt(contract, splits, date))) < 0.01 ? best : null;
};

/**
 * Dagens normtimer: normugens dagsfordeling når den gælder (samme ugesum som kontrakten på
 * datoen), ellers kontraktens normtid på datoen (norm_contract, ellers employees.weekly_norm).
 */
export const dayNorm = (contract: Norm, splits: NormSplit[] | null | undefined, date: string): number => {
  const split = activeSplit(contract, splits, date);
  return Number((split ? split.weekly_norm : contractAt(contract, splits, date))?.[weekdayIdx(date)] || 0);
};

/** Fordelinger grupperet pr. medarbejder. */
export const splitsByEmployee = (splits: NormSplit[]): Record<number, NormSplit[]> => {
  const out: Record<number, NormSplit[]> = {};
  for (const s of splits) {
    (out[s.employee_id] = out[s.employee_id] || []).push(s);
  }
  return out;
};
