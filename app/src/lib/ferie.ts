/** Valget i "Fravær/ferie samme dag?" for en halv feriedag. Gemmes som fraværstype "Ferie" på en arbejdsdag. */
export const HALF_HOLIDAY = "½ feriedag";

/**
 * Feriedage en registrering bruger: en hel feriedag = 1, ferie på en arbejdsdag (½ feriedag) = 0,5.
 */
export const holidayDays = (e: { absence_type?: string | null; location?: string | null }): number =>
  e.absence_type === "Ferie" ? (e.location ? 0.5 : 1) : 0;
