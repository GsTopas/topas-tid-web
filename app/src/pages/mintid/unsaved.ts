import { parseNum } from "../../lib/format";
import type { AllocLine, DayFormState } from "./types";
import { WORK_DAY_TYPES } from "./constants";

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

/** Er timelinjen udfyldt nok til at blive gemt (virksomhed/projekt, timer > 0 og opgavetype, hvor den er obligatorisk)? */
export const lineReady = (l: AllocLine, taskRequired: boolean): boolean =>
  !!String(l.company_id ?? "") && (parseNum(l.hours) || 0) > 0 && (!taskRequired || !!l.task_type);

/**
 * Sletter et skift af dagtype timer på dagen? Det gør et skift fra en arbejdsdag (Kontor / Andet sted / Rejsedag)
 * til fravær, ferie eller "Ingen", når dagen har gemte arbejdstimer/timefordeling eller udfyldte timelinjer i formularen:
 * ved "Gem dagen" bliver mødt/gået og timefordelingen så slettet. Bruges til "Er du sikker?"-spørgsmålet.
 */
export const typeChangeDropsHours = (from: string, to: string, savedHours: number, form: DayFormState | null): boolean =>
  WORK_DAY_TYPES.includes(from) && !WORK_DAY_TYPES.includes(to) &&
  (savedHours > 0 || !!form?.allocations.some(l => !!String(l.company_id ?? "") && (parseNum(l.hours) || 0) > 0));
