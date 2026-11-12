/**
 * Fordelingskategori pr. opgavetype (`task_types.distribution_category`, Gorm 12. nov. 2026).
 * Vælges i Settings → Opgavetyper og vises kun dér og i Fakturering (kolonne ved siden af "Opgave").
 * Teksterne er også tilladte værdier i databasens CHECK-constraint; ret begge steder.
 */
export const FORDELINGSKATEGORIER = [
  "Undersøgelse af muligheder",
  "1. Nye driftsmæssige funktionaliteter",
  "2. Konfigurering, tilpasning, opsætning og kodning",
  "3. Integration af cloud-/ERP-udbyderens egne systemer",
  "4. Design, layout, indhold, tekster og billeder",
  "5. Migrering af data og indhold",
  "6. Test af funktioner",
  "7. Træning af medarbejdere",
  "8. Vedligehold og videreførelse af eksisterende funktionalitet",
  "9. Abonnement, licens og hosting",
] as const;

/** Opslag (afdeling, opgavetype) → fordelingskategori. Opgavetyper er pr. afdeling, så begge indgår. */
export type KategoriOpslag = (dept: string, ty: string) => string;

export const kategoriKey = (dept: string, ty: string): string => `${dept}|${ty}`;

export function makeKategoriOpslag(rows: { department: string; name: string; distribution_category: string | null }[]): KategoriOpslag {
  const map = new Map(rows.filter(r => r.distribution_category).map(r => [kategoriKey(r.department, r.name), r.distribution_category as string]));
  return (dept, ty) => map.get(kategoriKey(dept, ty)) || "";
}
