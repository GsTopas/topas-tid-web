import { describe, expect, it } from "vitest";
import { kontrolSum } from "./saldo";

const norm = { 0: 7.5, 1: 7.5, 2: 7.5, 3: 7.5, 4: 7, 5: 0, 6: 0 };

describe("kontrolSum", () => {
  it("summerer arbejdstid + fravær − norm for arbejdsdage", () => {
    expect(kontrolSum([
      { work_date: "2026-09-28", location: "Kontor", work_hours: 7.5, absence_hours: null }, // man: 0
      { work_date: "2026-10-02", location: "Kontor", work_hours: 6, absence_hours: 1.5 }, // fre: +0,5
      { work_date: "2026-10-03", location: "Andet sted", work_hours: "2", absence_hours: null }, // lør: +2
    ], norm)).toBe(2.5);
  });
  it("springer hele fraværsdage og tomme dage over", () => {
    expect(kontrolSum([
      { work_date: "2026-10-12", location: null, work_hours: null, absence_hours: null },
      { work_date: "2026-10-13", location: "", work_hours: 7.5, absence_hours: null },
    ], norm)).toBe(0);
  });
});
