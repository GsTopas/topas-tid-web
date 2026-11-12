import { HALF_HOLIDAY } from "../../lib/ferie";

/** Kode 50 med fritekst i stedet for de faste valg. Kan kun vælges af admins (Gorm, 12.11.2026). */
export const FIRM_PAID_FREE_TEXT = "Andet – firmabetalt (fritekst)";

/** Gemmes i absence_choice, så "Andet – firmabetalt (fritekst)" kan kendes fra "Andet – firmabetalt" (begge kode 50). */
export const FREE_TEXT_CHOICE = "Fritekst";

/**
 * Kode 51 (tidligere "Andet – egen betalt"). Siden 12.11.2026 er det ikke fravær, men flexfri:
 * timerne vises ikke i Fravær/Frav.timer eller Fravær & løn, men trækkes fra i Kontrol (se lib/saldo.ts).
 */
export const FLEXFRI = "Andet fravær - flexfri eller lign.";

/** Typer der kun kan vælges af admins (vises dog altid, hvis dagen allerede har typen). */
export const ADMIN_ONLY_TYPES = [FIRM_PAID_FREE_TEXT];

/** Dagtyper i Min tid: [navn, ikon]. */
export const DAY_TYPES: [string, string][] = [["Kontor", "🏢"], ["Andet sted", "🏠"], ["Rejsedag", "✈️"], ["Ferie", "🏖️"], ["Egen sygdom", "🤒"], ["Barn syg", "👶"], ["Andet – firmabetalt", "🏥"], [FIRM_PAID_FREE_TEXT, "📝"], [FLEXFRI, "⏳"], ["Ingen", "🚫"]];

/** Dagtyper hvor der arbejdes (mødt/gået/frokost + timefordeling). */
export const WORK_DAY_TYPES = ["Kontor", "Andet sted", "Rejsedag"];

/** Dagtyper der har et "Hvor?"-felt. */
export const LOCATION_NOTE_TYPES = ["Andet sted", "Rejsedag"];

/** Fraværstyper (hele dagen, eller delvist på en arbejdsdag). */
export const ABSENCE_TYPES = ["Egen sygdom", "Barn syg", "Andet – firmabetalt", FIRM_PAID_FREE_TEXT, FLEXFRI];

/** Typer med fritekstfelt (gemmes i absence_note). */
export const FREE_TEXT_TYPES = [FIRM_PAID_FREE_TEXT, FLEXFRI];

/** Valg i "Fravær/ferie samme dag?" på en arbejdsdag: fraværstyperne + ½ feriedag. */
export const PARTIAL_ABSENCE_TYPES = [HALF_HOLIDAY, ...ABSENCE_TYPES];

/** "Andet"-fravær gemmes som "Øvrigt fravær" med lønkode 50 (firmabetalt, også fritekst-varianten) eller 51 (flexfri). */
const OTHER_ABSENCE_CODES: Record<string, string> = {
  "Andet – firmabetalt": "50",
  [FIRM_PAID_FREE_TEXT]: "50",
  [FLEXFRI]: "51"
};

/** UI-dagtype → dagtype i databasen. */
export const toDbDayType = (t: string): string => OTHER_ABSENCE_CODES[t] ? "Øvrigt fravær" : t === HALF_HOLIDAY ? "Ferie" : t;

/** Lønkode for en fraværstype (Barn syg = 20). */
export const absenceCodeFor = (t: string): string | null => OTHER_ABSENCE_CODES[t] || (t === "Barn syg" ? "20" : null);

/** absence_choice til databasen: fritekst-varianten får FREE_TEXT_CHOICE, "Andet – firmabetalt" sit valg. */
export const absenceChoiceFor = (t: string | null | undefined, choice: string | null | undefined): string | null =>
  t === FIRM_PAID_FREE_TEXT ? FREE_TEXT_CHOICE : t === "Andet – firmabetalt" && choice && choice !== FREE_TEXT_CHOICE ? choice : null;

/** Fraværstype + kode (+ valg) fra databasen → UI-dagtype. */
export const fromDbAbsenceType = (type: string | null | undefined, code: unknown, choice?: unknown): string | null | undefined =>
  type === "Øvrigt fravær" ? code === "51" ? FLEXFRI : choice === FREE_TEXT_CHOICE ? FIRM_PAID_FREE_TEXT : "Andet – firmabetalt" : type;

type AbsenceRow = { location?: string | null; absence_type?: string | null; absence_code?: unknown; absence_choice?: string | null };

/** Fraværstypen som den vises i lister: den konkrete "Andet"-type i stedet for "Øvrigt fravær", ½ feriedag for ferie på en arbejdsdag. */
export const absenceLabel = (e: AbsenceRow): string =>
  e.absence_type === "Ferie" && e.location ? HALF_HOLIDAY : String(fromDbAbsenceType(e.absence_type, e.absence_code, e.absence_choice) ?? "");

/** Valget i "Hvilken slags?" som det vises i lister (fritekst-markøren vises ikke). */
export const choiceLabel = (choice: string | null | undefined): string => choice && choice !== FREE_TEXT_CHOICE ? choice : "";

/** Fraværstype på en arbejdsdag → valget i "Fravær/ferie samme dag?" (Ferie = ½ feriedag). */
export const fromDbPartialAbsence = (type: string | null | undefined, code: unknown, choice?: unknown): string =>
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
