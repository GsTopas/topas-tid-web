import { describe, expect, it } from "vitest";
import { dayDefaults } from "../pages/mintid/normweek";

describe("dayDefaults (normuge)", () => {
  it("bruger normugens tider for ugedagen", () => {
    expect(dayDefaults({ weekday: 0, time_in: "06:00", time_out: "15:00", lunch_min: 30 }, 7.5))
      .toEqual({ time_in: "06:00", time_out: "15:00", lunch_min: 30 });
  });
  it("uden normuge: 08:00 + normtid + ½ time og 30 min frokost som før", () => {
    expect(dayDefaults(undefined, 7.5)).toEqual({ time_in: "08:00", time_out: "16:00", lunch_min: 30 });
    expect(dayDefaults(null, 7)).toEqual({ time_in: "08:00", time_out: "15:30", lunch_min: 30 });
  });
});
