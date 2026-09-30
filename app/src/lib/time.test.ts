import { describe, expect, it } from "vitest";
import { defaultTimeOut, inferLunchMin, roundQuarter, workHours, workHoursRaw } from "../pages/mintid/time";

// Forventede værdier er beregnet ved at køre de originale minificerede udtryk (Cb, rE, Yo og
// default-"Gået"/frokost-beregningen i dags-effekten) i node.

describe("workHoursRaw (Cb)", () => {
  it("trækker 30 min frokost fra som standard", () => {
    expect(workHoursRaw("08:00", "16:00")).toBe(7.5);
  });
  it("bruger den angivne frokost", () => {
    expect(workHoursRaw("08:00", "16:00", 0)).toBe(8);
    expect(workHoursRaw("08:00", "16:00", 45)).toBe(7.25);
  });
  it("regner med minutter og runder ikke", () => {
    expect(workHoursRaw("08:10", "16:25", 30)).toBe(7.75);
  });
  it("er aldrig negativ", () => {
    expect(workHoursRaw("16:00", "08:00")).toBe(0);
    expect(workHoursRaw("08:00", "08:20")).toBe(0);
  });
  it("giver null når et tidspunkt mangler", () => {
    expect(workHoursRaw("", "16:00")).toBeNull();
    expect(workHoursRaw("08:00", null)).toBeNull();
  });
});

describe("roundQuarter (rE)", () => {
  it("runder til nærmeste kvarter, halve op", () => {
    expect(roundQuarter(7.125)).toBe(7.25);
    expect(roundQuarter(7.124)).toBe(7);
    expect(roundQuarter(7.375)).toBe(7.5);
    expect(roundQuarter(7.875)).toBe(8);
    expect(roundQuarter(0.1)).toBe(0);
  });
});

describe("workHours (Yo) = gået − mødt − frokost − fravær", () => {
  it("normal dag", () => {
    expect(workHours("08:00", "16:00", 30)).toBe(7.5);
  });
  it("trækker delvist fravær fra", () => {
    expect(workHours("08:00", "16:00", 30, 1.5)).toBe(6);
  });
  it("afrunder til kvarter", () => {
    expect(workHours("08:10", "16:25", 30)).toBe(7.75);
    expect(workHours("08:00", "16:07", 30)).toBe(7.5);
    expect(workHours("08:00", "16:08", 30)).toBe(7.75);
  });
  it("udeladt frokost giver standard 30 min", () => {
    expect(workHours("08:00", "16:00", undefined)).toBe(7.5);
  });
  it("aldrig under 0", () => {
    expect(workHours("08:00", "09:00", 30, 2)).toBe(0);
  });
  it("manglende tid giver 0", () => {
    expect(workHours(null, "16:00", 30)).toBe(0);
  });
  it("falsy fravær (fx NaN) tæller som 0", () => {
    expect(workHours("08:00", "16:00", 0, NaN)).toBe(8);
  });
});

describe("defaultTimeOut (standard Gået = 08:00 + normtid + ½ time)", () => {
  it("beregner ud fra normtiden", () => {
    expect(defaultTimeOut(7.4)).toBe("15:54");
    expect(defaultTimeOut(7)).toBe("15:30");
    expect(defaultTimeOut(7.5)).toBe("16:00");
    expect(defaultTimeOut(8)).toBe("16:30");
    expect(defaultTimeOut(3.25)).toBe("11:45");
    expect(defaultTimeOut(0.25)).toBe("08:45");
    expect(defaultTimeOut(7.99)).toBe("16:29");
  });
  it("16:00 når dagen ingen normtid har", () => {
    expect(defaultTimeOut(0)).toBe("16:00");
    expect(defaultTimeOut(-1)).toBe("16:00");
  });
  it("bevarer originalens minut-afrunding (kan give :60)", () => {
    expect(defaultTimeOut(7.495)).toBe("15:60");
  });
});

describe("inferLunchMin (frokost udledt af gemt dag)", () => {
  it("brutto − arbejdstimer − fravær, i kvarterer", () => {
    expect(inferLunchMin("08:00", "16:00", 7.5, 0)).toBe(30);
    expect(inferLunchMin("08:00", "16:00", 7, 0.5)).toBe(30);
    expect(inferLunchMin("08:00", "16:00", 7.4, 0)).toBe(30);
    expect(inferLunchMin("08:00", "16:00", 7.3, 0)).toBe(45);
  });
  it("klemmes til 0–240", () => {
    expect(inferLunchMin("08:00", "16:00", 9, 0)).toBe(0);
    expect(inferLunchMin("06:00", "18:00", 4, 0)).toBe(240);
  });
});
