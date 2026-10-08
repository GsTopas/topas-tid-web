import { describe, expect, it } from "vitest";
import { holidayDays } from "./ferie";

describe("holidayDays", () => {
  it("hel feriedag tæller 1", () => expect(holidayDays({ absence_type: "Ferie", location: null })).toBe(1));
  it("ferie på en arbejdsdag (½ feriedag) tæller 0,5", () =>
    expect(holidayDays({ absence_type: "Ferie", location: "Kontor" })).toBe(0.5));
  it("andet fravær tæller ikke", () => {
    expect(holidayDays({ absence_type: "Egen sygdom", location: null })).toBe(0);
    expect(holidayDays({ absence_type: null, location: "Kontor" })).toBe(0);
  });
});
