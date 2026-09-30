import { DEFAULT_LUNCH_HOURS } from "./constants";

/** Timer mellem mødt og gået minus frokost (minutter), aldrig negativ. null hvis et tidspunkt mangler. */
export const workHoursRaw = (timeIn: string | null | undefined, timeOut: string | null | undefined, lunchMin: number = 30): number | null => {
  if (!timeIn || !timeOut) {
    return null;
  }
  const [inH, inM] = timeIn.split(":").map(Number);
  const [outH, outM] = timeOut.split(":").map(Number);
  return Math.max((outH * 60 + outM - inH * 60 - inM - lunchMin) / 60, 0);
};

/** Afrund til nærmeste kvarter. */
export const roundQuarter = (t: number): number => Math.round(t * 4) / 4;

/** Arbejdstimer = gået − mødt − frokost − delvist fravær, afrundet til kvarter. */
export const workHours = (timeIn: string | null | undefined, timeOut: string | null | undefined, lunchMin?: number, absenceHours: number = 0): number =>
  roundQuarter(Math.max(0, (workHoursRaw(timeIn, timeOut, lunchMin) ?? 0) - (absenceHours || 0)));

/** Standard "Gået": 08:00 + normtid + ½ time; "16:00" hvis dagen ingen normtid har. */
export const defaultTimeOut = (normHours: number): string => {
  const minutes = (normHours + DEFAULT_LUNCH_HOURS) * 60;
  // NOTE(recovery): minutterne rundes efter floor af timerne, så fx 59,6 min giver "xx:60" — bevaret som i originalen.
  return normHours > 0 ? `${String(8 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}` : "16:00";
};

/** Udled frokostminutter af en gemt dag: (gået − mødt) − arbejdstimer − fravær, rundet til kvarter, 0–240. */
export const inferLunchMin = (timeIn: string, timeOut: string, workHoursValue: number, absenceHours: number): number => {
  const gross = workHoursRaw(timeIn, timeOut, 0) ?? 0;
  return Math.min(240, Math.max(0, Math.round((gross - workHoursValue - absenceHours) * 60 / 15) * 15));
};
