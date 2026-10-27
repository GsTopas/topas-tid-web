import { describe, expect, it } from "vitest";
import { dayStatusIcon } from "./PeriodCalendar";
import { absenceLabel } from "./constants";
import type { DayStatusMap } from "./types";

const day = (entry: Record<string, unknown>, alloc: number): DayStatusMap =>
  ({ "2026-09-28": { entry: { work_date: "2026-09-28", ...entry }, alloc } } as unknown as DayStatusMap);

describe("dayStatusIcon", () => {
  it("arbejdsdag med delvist fravær er 🟢 når den er fordelt, uanset om fraværet er størst", () => {
    const base = { absence_type: "Øvrigt fravær", location: "Kontor" };
    expect(dayStatusIcon("2026-09-28", day({ ...base, work_hours: 4, absence_hours: 3.5 }, 4), false, "2026-10-27")).toBe("🟢");
    expect(dayStatusIcon("2026-09-28", day({ ...base, location: "Andet sted", work_hours: 2, absence_hours: 5.5 }, 2), false, "2026-10-27")).toBe("🟢");
    expect(dayStatusIcon("2026-09-28", day({ ...base, work_hours: 2, absence_hours: 5.5 }, 1), false, "2026-10-27")).toBe("🟠");
  });
  it("hel fraværsdag viser fraværsikonet", () => {
    expect(dayStatusIcon("2026-09-28", day({ location: null, absence_type: "Egen sygdom", absence_hours: 7.5 }, 0), false, "2026-10-27")).toBe("🤒");
  });
});

describe("absenceLabel", () => {
  it("viser den konkrete type i stedet for Øvrigt fravær", () => {
    expect(absenceLabel({ absence_type: "Øvrigt fravær", absence_code: "51" })).toBe("Andet – egen betalt");
    expect(absenceLabel({ absence_type: "Øvrigt fravær", absence_code: "50" })).toBe("Andet – firmabetalt");
    expect(absenceLabel({ absence_type: "Ferie", location: "Kontor" })).toBe("½ feriedag");
    expect(absenceLabel({ absence_type: "Egen sygdom" })).toBe("Egen sygdom");
  });
});
