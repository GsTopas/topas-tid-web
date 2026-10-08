/** Tal → "1,5" (to decimaler, dansk komma). Tom streng for null/"". */
export const fmtNum = (t: number | string | null | undefined): string =>
  t == null || t === "" ? "" : String(Math.round(Number(t) * 100) / 100).replace(".", ",");

/** Afrundet kronebeløb med dansk tusindtalsseparator. */
export const fmtKr = (t: number): string => Math.round(t).toLocaleString("da-DK");

/** "1,5" → 1.5; tom/ugyldig → null. */
export const parseNum = (t: unknown): number | null => {
  if (t == null || String(t).trim() === "") {
    return null;
  }
  const e = parseFloat(String(t).replace(",", "."));
  if (Number.isFinite(e)) {
    return e;
  } else {
    return null;
  }
};

/** ISO yyyy-mm-dd → dd.mm.yyyy */
export const fmtDate = (t: string): string => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Tidsstempel → "08.10.2026 kl. 14:32" (lokal tid). */
export const fmtStamp = (t: string): string => {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} kl. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "Godkendt af X 08.10.2026 kl. 14:32" — eller at oplysningen mangler (ældre godkendelser). */
export const approvedByText = (verb: string, name: string | null | undefined, at: string | null | undefined): string =>
  name && at ? `${verb} af ${name} ${fmtStamp(at)}` : `${verb} (hvem og hvornår er ikke registreret)`;

/** ISO-dato → ugedag, 0 = mandag … 6 = søndag. */
export const weekdayIdx = (t: string): number => (new Date(t + "T12:00:00").getDay() + 6) % 7;

export const addDays = (t: string, e: number): string => {
  const r = new Date(t + "T12:00:00");
  r.setDate(r.getDate() + e);
  return r.toISOString().slice(0, 10);
};

export const MONTHS = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];

/** "2026-03" / "2026-03-15" → "Marts 2026" */
export const monthLabel = (t: string): string => `${MONTHS[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`;
