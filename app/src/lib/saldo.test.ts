import { describe, expect, it } from "vitest";
import { kontrolDay, kontrolSum, oncallHours } from "./saldo";

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

describe("flexfri (kode 51)", () => {
  const flex = { absence_type: "Øvrigt fravær", absence_code: "51" };
  it("trækkes fra i Kontrol på en arbejdsdag: 07–15 med 5,5 t flexfri giver −5,5", () => {
    expect(kontrolDay({ work_date: "2026-09-30", location: "Andet sted", work_hours: 2, absence_hours: 5.5, ...flex }, 7.5)).toBe(-5.5);
  });
  it("hel flexfri-dag giver altid −dagens norm", () => {
    expect(kontrolDay({ work_date: "2026-09-30", location: null, work_hours: null, absence_hours: 4, ...flex }, 7.5)).toBe(-7.5);
    expect(kontrolDay({ work_date: "2026-09-30", location: null, work_hours: null, absence_hours: null, ...flex }, 7)).toBe(-7);
  });
  it("andet fravær tæller stadig med som før", () => {
    expect(kontrolDay({ work_date: "2026-09-30", location: "Kontor", work_hours: 2, absence_hours: 5.5, absence_type: "Øvrigt fravær", absence_code: "50" }, 7.5)).toBe(0);
    expect(kontrolDay({ work_date: "2026-09-30", location: null, work_hours: null, absence_hours: 7.5, absence_type: "Egen sygdom" }, 7.5)).toBe(null);
  });
  it("indgår i kontrolSum (ÅTD saldo)", () => {
    expect(kontrolSum([
      { work_date: "2026-09-28", location: null, work_hours: null, absence_hours: 7.5, ...flex },
      { work_date: "2026-09-30", location: "Andet sted", work_hours: 2, absence_hours: 5.5, ...flex },
    ], norm)).toBe(-13);
  });
});

describe("oncallHours", () => {
  it("læser vagttelefon-timer (tal eller tekst), 0 når der ingen er", () => {
    expect(oncallHours({ oncall_hours: 2 })).toBe(2);
    expect(oncallHours({ oncall_hours: "1.5" })).toBe(1.5);
    expect(oncallHours({ oncall_hours: null })).toBe(0);
    expect(oncallHours(undefined)).toBe(0);
  });
});
