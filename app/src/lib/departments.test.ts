import { describe, expect, it } from "vitest";
import { DEPARTMENTS, defaultTaskTracking, hasTaskTracking, isSimpleDepartment } from "./departments";

describe("isSimpleDepartment", () => {
  it("Topas Travel har enkel visning", () => {
    expect(DEPARTMENTS).toContain("Topas Travel");
    expect(isSimpleDepartment("Topas Travel")).toBe(true);
  });
  it("øvrige afdelinger og ingen afdeling har fuld visning", () => {
    for (const d of DEPARTMENTS.filter(d => d !== "Topas Travel")) {
      expect(isSimpleDepartment(d)).toBe(false);
    }
    expect(isSimpleDepartment(null)).toBe(false);
    expect(isSimpleDepartment("")).toBe(false);
  });
});

describe("hasTaskTracking", () => {
  it("følger fluebenet pr. medarbejder, også i Topas Travel", () => {
    expect(hasTaskTracking({ department: "Topas Travel", task_tracking: true })).toBe(true);
    expect(hasTaskTracking({ department: "Økonomi", task_tracking: false })).toBe(false);
  });
  it("uden flueben gælder afdelingens startværdi", () => {
    expect(hasTaskTracking({ department: "Topas Travel" })).toBe(false);
    expect(hasTaskTracking({ department: "Marketing", task_tracking: null })).toBe(true);
    expect(defaultTaskTracking("Topas Travel")).toBe(false);
    expect(defaultTaskTracking("IT")).toBe(true);
  });
});
