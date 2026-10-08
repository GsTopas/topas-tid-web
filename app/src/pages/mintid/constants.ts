import { HALF_HOLIDAY } from "../../lib/ferie";

/** Dagtyper i Min tid: [navn, ikon]. */
export const DAY_TYPES: [string, string][] = [["Kontor", "🏢"], ["Andet sted", "🏠"], ["Rejsedag", "✈️"], ["Ferie", "🏖️"], ["Egen sygdom", "🤒"], ["Barn syg", "👶"], ["Andet – firmabetalt", "🏥"], ["Andet – egen betalt", "💳"], ["Ingen", "🚫"]];

/** Dagtyper hvor der arbejdes (mødt/gået/frokost + timefordeling). */
export const WORK_DAY_TYPES = ["Kontor", "Andet sted", "Rejsedag"];

/** Dagtyper der har et "Hvor?"-felt. */
export const LOCATION_NOTE_TYPES = ["Andet sted", "Rejsedag"];

/** Fraværstyper (hele dagen, eller delvist på en arbejdsdag). */
export const ABSENCE_TYPES = ["Egen sygdom", "Barn syg", "Andet – firmabetalt", "Andet – egen betalt"];

/** Valg i "Fravær/ferie samme dag?" på en arbejdsdag: fraværstyperne + ½ feriedag. */
export const PARTIAL_ABSENCE_TYPES = [HALF_HOLIDAY, ...ABSENCE_TYPES];

/** "Andet"-fravær gemmes som "Øvrigt fravær" med lønkode 50 (firmabetalt) eller 51 (egen betalt). */
const OTHER_ABSENCE_CODES: Record<string, string> = {
  "Andet – firmabetalt": "50",
  "Andet – egen betalt": "51"
};

/** UI-dagtype → dagtype i databasen. */
export const toDbDayType = (t: string): string => OTHER_ABSENCE_CODES[t] ? "Øvrigt fravær" : t === HALF_HOLIDAY ? "Ferie" : t;

/** Lønkode for en fraværstype (Barn syg = 20). */
export const absenceCodeFor = (t: string): string | null => OTHER_ABSENCE_CODES[t] || (t === "Barn syg" ? "20" : null);

/** Fraværstype + kode fra databasen → UI-dagtype. */
export const fromDbAbsenceType = (type: string | null | undefined, code: unknown): string | null | undefined =>
  type === "Øvrigt fravær" ? code === "51" ? "Andet – egen betalt" : "Andet – firmabetalt" : type;

/** Fraværstype på en arbejdsdag → valget i "Fravær/ferie samme dag?" (Ferie = ½ feriedag). */
export const fromDbPartialAbsence = (type: string | null | undefined, code: unknown): string =>
  type === "Ferie" ? HALF_HOLIDAY : String(fromDbAbsenceType(type, code) ?? "");

export const WEEKDAYS_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const WEEKDAYS_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

/** Timer lagt til normtiden ved beregning af standard "Gået"-tid (svarer til 30 min frokost). */
export const DEFAULT_LUNCH_HOURS = 0.5;

/** Valgmuligheder for frokost i minutter. */
export const LUNCH_OPTIONS = [0, 15, 30, 45, 60, 90];

/** Statusikoner for fraværsdage i kalenderen. */
export const ABSENCE_ICONS: Record<string, string> = {
  Ferie: "🏖️",
  "Egen sygdom": "🤒",
  "Barn syg": "👶"
};
