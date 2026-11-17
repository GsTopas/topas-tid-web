/**
 * Projekt- eller driftsopgave (Gorm, 17. nov. 2026).
 * - Opgavetyper har `task_types.task_kind` = "projekt" | "drift" | null (ikke angivet), sat i Settings → Opgavetyper.
 * - En timelinje i Min tid starter med valget Projekt eller Drift: Projekt → et projekt (companies.kind = projekt)
 *   og alle opgavetyper (projektopgaver først; Gorm: man må godt vælge en driftsopgave under et projekt);
 *   Drift → et selskab (companies.kind = selskab) og driftsopgavetyper. Opgavetyper uden angivelse kan vælges under begge.
 * Linjens art gemmes ikke; den udledes af det valgte selskab/projekt.
 */
export type Opgaveart = "projekt" | "drift";

export const OPGAVEARTER: { value: Opgaveart; label: string; plural: string }[] = [
  { value: "projekt", label: "Projektopgave", plural: "Projektopgaver" },
  { value: "drift", label: "Driftsopgave", plural: "Driftsopgaver" },
];

export const opgaveartLabel = (k: string | null | undefined): string => OPGAVEARTER.find(o => o.value === k)?.label || "";

/** companies.kind → linjens art: et projekt er projektopgave, et selskab driftsopgave. */
export const artForCompany = (companyKind: string | null | undefined): Opgaveart | "" =>
  companyKind === "projekt" ? "projekt" : companyKind === "selskab" ? "drift" : "";

/** Selskaber/projekter, der kan vælges for en art ("" = alle). */
export function companiesForArt<T extends { id: number }>(art: Opgaveart | "", companies: T[], companyKinds: Record<number, string>): T[] {
  return art ? companies.filter(c => artForCompany(companyKinds[c.id]) === art) : companies;
}

/** Opgavetyper, der kan vælges for en art: Drift = driftsopgaver + typer uden angivelse; Projekt og "" = alle. */
export function tasksForArt(art: Opgaveart | "", options: string[], taskKinds: Record<string, string>): string[] {
  return art === "drift" ? options.filter(o => !taskKinds[o] || taskKinds[o] === "drift") : options;
}

/** Opgavetyperne grupperet til <optgroup> (kun grupper med indhold; "Øvrige" = ikke angivet). */
export function groupTasks(options: string[], taskKinds: Record<string, string>): { label: string; options: string[] }[] {
  const groups = [
    ...OPGAVEARTER.map(o => ({ label: o.plural, options: options.filter(t => taskKinds[t] === o.value) })),
    { label: "Øvrige", options: options.filter(t => !taskKinds[t]) },
  ];
  return groups.filter(g => g.options.length > 0);
}

/**
 * Test (Gorm, 17. nov. 2026): Projekt/drift vises indtil videre kun for Gorm Sølvsten Nielsen (1), Morten Kusk (3)
 * og Lasse Møller (74), dvs. den indloggede bruger. Alle andre har Min tid og Opgavetyper som før.
 * Slå det til for alle ved at lade `opgaveartEnabled` returnere true.
 */
export const OPGAVEART_TESTERS: readonly number[] = [1, 3, 74];
export const opgaveartEnabled = (employeeId: number | null | undefined): boolean =>
  employeeId != null && OPGAVEART_TESTERS.includes(employeeId);
