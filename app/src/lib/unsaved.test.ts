import { describe, expect, it } from "vitest";
import { formChanged } from "../pages/mintid/unsaved";
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
