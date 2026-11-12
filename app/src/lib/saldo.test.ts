import { describe, expect, it } from "vitest";
import { dayKontrol, flexFreeHours, kontrolSum, oncallHours } from "./saldo";

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
  it("trækkes fra i Kontrol på en arbejdsdag i stedet for at tælle som fravær", () => {
    // Ons 30.09: Andet sted 07–15, 5,5 t flexfri, 2 t arbejde → Kontrol −5,5
    expect(dayKontrol({ work_date: "2026-09-30", location: "Andet sted", work_hours: 2, absence_hours: 5.5, ...flex }, 7.5)).toBe(-5.5);
  });
  it("hel flexfri-dag giver minus timerne", () => {
    expect(dayKontrol({ work_date: "2026-11-05", location: null, work_hours: null, absence_hours: 7.5, ...flex }, 7.5)).toBe(-7.5);
  });
  it("andet fravær tæller stadig med som før", () => {
    expect(dayKontrol({ work_date: "2026-09-30", location: "Kontor", work_hours: 2, absence_hours: 5.5, absence_type: "Øvrigt fravær", absence_code: "50" }, 7.5)).toBe(0);
    expect(dayKontrol({ work_date: "2026-09-30", location: null, work_hours: null, absence_hours: 7.5, absence_type: "Egen sygdom", absence_code: null }, 7.5)).toBeNull();
    expect(flexFreeHours({ absence_type: "Øvrigt fravær", absence_code: "50", absence_hours: 3 })).toBe(0);
  });
  it("indgår i kontrolSum (ÅTD saldo)", () => {
    expect(kontrolSum([
      { work_date: "2026-09-30", location: "Andet sted", work_hours: 2, absence_hours: 5.5, ...flex }, // ons: −5,5
      { work_date: "2026-10-02", location: null, work_hours: null, absence_hours: 7, ...flex }, // fre hel dag: −7
    ], norm)).toBe(-12.5);
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
