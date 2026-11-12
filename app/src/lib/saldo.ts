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
 * Flexfri-timer på en dag ("Andet fravær - flexfri eller lign.", Øvrigt fravær med kode 51).
 * De tæller ikke som fravær; de trækkes i stedet fra i Kontrol, ÅTD saldo og Flex (Gorm, 12 Nov 2026).
 */
export const flexFreeHours = (e: { absence_type?: string | null; absence_code?: unknown; absence_hours?: number | string | null } | null | undefined): number =>
  e?.absence_type === "Øvrigt fravær" && e.absence_code === "51" && e.absence_hours != null ? Number(e.absence_hours) || 0 : 0;

/**
 * Kontrol for én dag: arbejdstid + (betalt) fravær − dagens norm på dage med arbejdssted,
 * minus flexfri-timer (også på en hel flexfri-dag uden arbejdssted). null = dagen har ingen Kontrol.
 */
export function dayKontrol(e: KontrolEntry | null | undefined, norm: number): number | null {
  if (!e) {
    return null;
  }
  const flex = flexFreeHours(e);
  if (e.work_hours != null && e.location) {
    const absence = e.absence_hours != null ? Number(e.absence_hours) : 0;
    return Number(e.work_hours) + absence - flex - norm;
  }
  return flex > 0 ? -flex : null;
}

/** Vagttelefon-timer på en dag (0 når der ingen er). */
export const oncallHours = (e: { oncall_hours?: number | string | null } | null | undefined): number =>
  e?.oncall_hours != null ? Number(e.oncall_hours) || 0 : 0;

/**
 * Sum af Kontrol-kolonnen (se dayKontrol) — samme regel som "I ALT" i Min periode. Dagens norm følger
 * normugens dagsfordeling, når den gælder (se lib/norm.ts). Vagttelefon tæller ikke med.
 */
export function kontrolSum(entries: KontrolEntry[], norm: Norm | null | undefined, splits?: NormSplit[] | null): number {
  let sum = 0;
  for (const e of entries) {
    sum += dayKontrol(e, dayNorm(norm, splits, e.work_date)) ?? 0;
  }
  return sum;
}
