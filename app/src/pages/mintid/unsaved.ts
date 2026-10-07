import type { AllocLine, DayFormState } from "./types";

/** Tom timelinje (fx lige tilføjet med "➕ Tilføj linje") — gemmes ikke, så tæller ikke som ændring. */
const isBlankLine = (l: AllocLine): boolean => !String(l.company_id ?? "") && !l.task_type && !l.hours.trim() && !l.task_note.trim();

/** Formularen som sammenlignelig tekst (company_id kan være tal fra DB eller tekst fra <select>). */
const normalize = (f: DayFormState): string => JSON.stringify({
  ...f,
  lunch_min: Number(f.lunch_min),
  allocations: f.allocations.filter(l => !isBlankLine(l)).map(l => [String(l.company_id ?? ""), l.task_type, l.hours.trim(), l.task_note.trim()])
});

/** Er dagsformularen ændret i forhold til det der sidst blev hentet/gemt? */
export const formChanged = (form: DayFormState | null, saved: DayFormState | null): boolean =>
  !!form && !!saved && normalize(form) !== normalize(saved);
