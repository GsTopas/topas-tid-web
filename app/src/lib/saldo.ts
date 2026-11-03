import { dayNorm, type NormSplit } from "./norm";

type Norm = Record<number, number | string | null | undefined>;

export interface KontrolEntry {
  work_date: string;
  location: string | null;
  work_hours: number | string | null;
  absence_hours: number | string | null;
  /** Vagttelefon-timer: lægges oveni (også på en dag uden arbejde). */
  oncall_hours?: number | string | null;
}

/** Vagttelefon-timer på en dag (0 når der ingen er). */
export const oncallHours = (e: { oncall_hours?: number | string | null } | null | undefined): number =>
  e?.oncall_hours != null ? Number(e.oncall_hours) || 0 : 0;

/**
 * Sum af Kontrol-kolonnen (arbejdstid + fravær − dagens norm) for dage med
 * registreret arbejdssted — samme regel som "I ALT" i Min periode. Dagens norm følger
 * normugens dagsfordeling, når den gælder (se lib/norm.ts). Vagttelefon-timer lægges oveni
 * på alle dage (også fraværsdage og dage uden arbejde).
 */
export function kontrolSum(entries: KontrolEntry[], norm: Norm | null | undefined, splits?: NormSplit[] | null): number {
  let sum = 0;
  for (const e of entries) {
    sum += oncallHours(e);
    if (e.work_hours == null || !e.location) {
      continue;
    }
    const absence = e.absence_hours != null ? Number(e.absence_hours) : 0;
    sum += Number(e.work_hours) + absence - dayNorm(norm, splits, e.work_date);
  }
  return sum;
}
