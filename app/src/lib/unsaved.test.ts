import { describe, expect, it } from "vitest";
import { formChanged, lineReady, typeChangeDropsHours } from "../pages/mintid/unsaved";
import type { DayFormState } from "../pages/mintid/types";

const base: DayFormState = {
  day_type: "Kontor",
  extra_abs: "",
  absence_choice: "",
  location_note: "",
  absence_note: "",
  absence_hours: "7,5",
  time_in: "08:00",
  time_out: "16:00",
  lunch_min: 30,
  work_hours: "7,5",
  note: "",
  allocations: [{ company_id: 3, task_type: "Drift", hours: "7,5", task_note: "" }]
};

describe("formChanged (påmindelse om ikke-gemt dag)", () => {
  it("er falsk når intet er ændret", () => {
    expect(formChanged({ ...base }, base)).toBe(false);
  });
  it("er falsk før formularen er hentet", () => {
    expect(formChanged(null, base)).toBe(false);
    expect(formChanged(base, null)).toBe(false);
  });
  it("opdager ændrede tider og timer", () => {
    expect(formChanged({ ...base, time_out: "16:30", work_hours: "8" }, base)).toBe(true);
    expect(formChanged({ ...base, allocations: [{ ...base.allocations[0], hours: "4" }] }, base)).toBe(true);
  });
  it("opdager ny dagtype og nye timelinjer", () => {
    expect(formChanged({ ...base, day_type: "Ferie" }, base)).toBe(true);
    expect(formChanged({ ...base, allocations: [...base.allocations, { company_id: "5", task_type: "", hours: "1", task_note: "" }] }, base)).toBe(true);
  });
  it("ignorerer en tom tilføjet linje og tal vs. tekst i virksomheds-id", () => {
    expect(formChanged({ ...base, allocations: [...base.allocations, { company_id: "", task_type: "", hours: "", task_note: "" }] }, base)).toBe(false);
    expect(formChanged({ ...base, allocations: [{ ...base.allocations[0], company_id: "3" }] }, base)).toBe(false);
  });
});

describe("lineReady (autogem ved \"Tilføj linje\")", () => {
  const line = { company_id: 3, task_type: "Drift", hours: "2", task_note: "" };
  it("er sand for en udfyldt linje", () => {
    expect(lineReady(line, true)).toBe(true);
    expect(lineReady({ ...line, hours: "1,5", company_id: "3" }, true)).toBe(true);
  });
  it("kræver virksomhed/projekt og timer > 0", () => {
    expect(lineReady({ ...line, company_id: "" }, true)).toBe(false);
    expect(lineReady({ ...line, hours: "" }, true)).toBe(false);
    expect(lineReady({ ...line, hours: "0" }, true)).toBe(false);
  });
  it("kræver kun opgavetype, når den er obligatorisk", () => {
    expect(lineReady({ ...line, task_type: "" }, true)).toBe(false);
    expect(lineReady({ ...line, task_type: "" }, false)).toBe(true);
  });
});

describe("typeChangeDropsHours (Er du sikker? ved skift til fravær)", () => {
  const noLines = { ...base, allocations: [] };
  it("spørger ved skift fra arbejdsdag til fravær, når dagen har gemte timer", () => {
    expect(typeChangeDropsHours("Kontor", "Barn syg", 7.5, noLines)).toBe(true);
    expect(typeChangeDropsHours("Rejsedag", "Ferie", 7.5, noLines)).toBe(true);
    expect(typeChangeDropsHours("Andet sted", "Ingen", 7.5, noLines)).toBe(true);
  });
  it("spørger, når formularen har udfyldte timelinjer, selv om intet er gemt", () => {
    expect(typeChangeDropsHours("Kontor", "Egen sygdom", 0, base)).toBe(true);
  });
  it("spørger ikke uden timer (fx en forudfyldt normdag)", () => {
    expect(typeChangeDropsHours("Kontor", "Barn syg", 0, noLines)).toBe(false);
    expect(typeChangeDropsHours("Kontor", "Barn syg", 0, { ...base, allocations: [{ company_id: "", task_type: "", hours: "", task_note: "" }] })).toBe(false);
  });
  it("spørger ikke ved skift mellem arbejdsdage eller fra fravær", () => {
    expect(typeChangeDropsHours("Kontor", "Andet sted", 7.5, base)).toBe(false);
    expect(typeChangeDropsHours("Barn syg", "Ferie", 7.5, base)).toBe(false);
  });
});
