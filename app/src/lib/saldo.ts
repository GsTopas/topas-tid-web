import { weekdayIdx } from "./format";

type Norm = Record<number, number | string | null | undefined>;

export interface KontrolEntry {
  work_date: string;
  location: string | null;
  work_hours: number | string | null;
  absence_hours: number | string | null;
}

/**
 * Sum af Kontrol-kolonnen (arbejdstid + fravær − dagens norm) for dage med
 * registreret arbejdssted — samme regel som "I ALT" i Min periode.
 */
export function kontrolSum(entries: KontrolEntry[], norm: Norm | null | undefined): number {
  let sum = 0;
  for (const e of entries) {
    if (e.work_hours == null || !e.location) {
      continue;
    }
    const absence = e.absence_hours != null ? Number(e.absence_hours) : 0;
    sum += Number(e.work_hours) + absence - Number(norm?.[weekdayIdx(e.work_date)] || 0);
  }
  return sum;
}
