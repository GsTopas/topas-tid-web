import { dayNorm, type NormSplit } from "./norm";

type Norm = Record<number, number | string | null | undefined>;

export interface KontrolEntry {
  work_date: string;
  location: string | null;
  work_hours: number | string | null;
  absence_hours: number | string | null;
  absence_type?: string | null;
  absence_code?: string | null;
}

/**
 * Flexfri ("Andet fravær - flexfri eller lign.", kode 51): ikke fravær, men timer der trækkes
 * fra i Kontrol og ÅTD saldo (Gorm, 12.11.2026). Vises ikke i Fravær/Frav.timer eller Fravær & løn.
 */
export const isFlexfri = (e: { absence_type?: string | null; absence_code?: unknown } | null | undefined): boolean =>
  e?.absence_type === "Øvrigt fravær" && String(e.absence_code ?? "") === "51";

/**
 * Kontrol for én dag, eller null når dagen ikke har Kontrol.
 * - Arbejdsdag: arbejdstid + fravær − dagens norm. Flexfri tæller ikke som fravær, så
 *   07–15 med 5,5 t flexfri giver 2 − 7,5 = −5,5.
 * - Hel flexfri-dag (uden arbejdssted): −flexfri-timerne (uden timer: −dagens norm).
 * - Andre dage uden arbejdssted: ingen Kontrol.
 */
export function kontrolDay(e: KontrolEntry, dayNormHours: number): number | null {
  const flexfri = isFlexfri(e);
  const absence = e.absence_hours != null ? Number(e.absence_hours) || 0 : 0;
  if (e.work_hours != null && e.location) {
    return Number(e.work_hours) + (flexfri ? 0 : absence) - dayNormHours;
  }
  if (flexfri) {
    return -(e.absence_hours != null ? absence : dayNormHours);
  }
  return null;
}

/** Vagttelefon-timer på en dag (0 når der ingen er). */
export const oncallHours = (e: { oncall_hours?: number | string | null } | null | undefined): number =>
  e?.oncall_hours != null ? Number(e.oncall_hours) || 0 : 0;

/**
 * Sum af Kontrol-kolonnen (arbejdstid + fravær − dagens norm) for dage med
 * registreret arbejdssted (og flexfri-dage, se kontrolDay) — samme regel som "I ALT" i Min periode. Dagens norm følger
 * normugens dagsfordeling, når den gælder (se lib/norm.ts). Vagttelefon tæller ikke med.
 */
export function kontrolSum(entries: KontrolEntry[], norm: Norm | null | undefined, splits?: NormSplit[] | null): number {
  let sum = 0;
  for (const e of entries) {
    sum += kontrolDay(e, dayNorm(norm, splits, e.work_date)) ?? 0;
  }
  return sum;
}
