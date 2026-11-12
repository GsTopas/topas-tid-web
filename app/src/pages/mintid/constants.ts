import { HALF_HOLIDAY } from "../../lib/ferie";

/** "Andet fravær" med lønkode 51: flexfri o.l. Tæller ikke som fravær, men trækkes fra i Kontrol/saldo (Gorm, 12 Nov 2026). */
export const FLEX_FREE = "Andet fravær - flexfri eller lign.";

/** Firmabetalt "andet fravær" med fritekst i stedet for en fast valgmulighed. Kun admins kan vælge den. */
export const ADMIN_PAID = "Andet firma betalt fravær";

/** Dagtyper i Min tid: [navn, ikon]. */
export const DAY_TYPES: [string, string][] = [["Kontor", "🏢"], ["Andet sted", "🏠"], ["Rejsedag", "✈️"], ["Ferie", "🏖️"], ["Egen sygdom", "🤒"], ["Barn syg", "👶"], ["Andet – firmabetalt", "🏥"], [ADMIN_PAID, "📝"], [FLEX_FREE, "⏳"], ["Ingen", "🚫"]];

/** Dagtyper/fraværstyper som kun admins kan vælge. */
export const ADMIN_ONLY_TYPES = [ADMIN_PAID];

/** Dagtyper hvor der arbejdes (mødt/gået/frokost + timefordeling). */
export const WORK_DAY_TYPES = ["Kontor", "Andet sted", "Rejsedag"];

/** Dagtyper der har et "Hvor?"-felt. */
export const LOCATION_NOTE_TYPES = ["Andet sted", "Rejsedag"];

/** Fraværstyper (hele dagen, eller delvist på en arbejdsdag). */
export const ABSENCE_TYPES = ["Egen sygdom", "Barn syg", "Andet – firmabetalt", ADMIN_PAID, FLEX_FREE];

/** Valg i "Fravær/ferie samme dag?" på en arbejdsdag: fraværstyperne + ½ feriedag. */
export const PARTIAL_ABSENCE_TYPES = [HALF_HOLIDAY, ...ABSENCE_TYPES];

/**
 * "Andet"-fravær gemmes som "Øvrigt fravær" med lønkode 50 (firmabetalt) eller 51 (flexfri).
 * "Andet firma betalt fravær" er kode 50 med `absence_choice` = ADMIN_PAID og fritekst i `absence_note`.
 */
const OTHER_ABSENCE_CODES: Record<string, string> = {
  "Andet – firmabetalt": "50",
  [ADMIN_PAID]: "50",
  [FLEX_FREE]: "51"
};

/** UI-dagtype → dagtype i databasen. */
export const toDbDayType = (t: string): string => OTHER_ABSENCE_CODES[t] ? "Øvrigt fravær" : t === HALF_HOLIDAY ? "Ferie" : t;

/** Lønkode for en fraværstype (Barn syg = 20). */
export const absenceCodeFor = (t: string): string | null => OTHER_ABSENCE_CODES[t] || (t === "Barn syg" ? "20" : null);

/** Fraværstype + kode (+ valg) fra databasen → UI-dagtype. */
export const fromDbAbsenceType = (type: string | null | undefined, code: unknown, choice?: string | null): string | null | undefined =>
  type === "Øvrigt fravær" ? code === "51" ? FLEX_FREE : choice === ADMIN_PAID ? ADMIN_PAID : "Andet – firmabetalt" : type;

/** Flexfri (kode 51): tæller ikke som fravær, men trækkes fra i Kontrol, ÅTD saldo og Flex. */
export const isFlexFree = (e: { absence_type?: string | null; absence_code?: unknown } | null | undefined): boolean =>
  e?.absence_type === "Øvrigt fravær" && e.absence_code === "51";

/** Fraværstypen som den vises i lister: den konkrete "Andet"-type i stedet for "Øvrigt fravær", ½ feriedag for ferie på en arbejdsdag. */
export const absenceLabel = (e: { location?: string | null; absence_type?: string | null; absence_code?: unknown; absence_choice?: string | null }): string =>
  e.absence_type === "Ferie" && e.location ? HALF_HOLIDAY : String(fromDbAbsenceType(e.absence_type, e.absence_code, e.absence_choice) ?? "");

/** Valgmuligheden som den vises i lister (tom for "Andet firma betalt fravær", hvor valget kun er en markør). */
export const absenceChoiceLabel = (choice: string | null | undefined): string => choice && choice !== ADMIN_PAID ? choice : "";

/** Fraværstype på en arbejdsdag → valget i "Fravær/ferie samme dag?" (Ferie = ½ feriedag). */
export const fromDbPartialAbsence = (type: string | null | undefined, code: unknown, choice?: string | null): string =>
  type === "Ferie" ? HALF_HOLIDAY : String(fromDbAbsenceType(type, code, choice) ?? "");

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
