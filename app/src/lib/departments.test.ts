import { describe, expect, it } from "vitest";
import { DEPARTMENTS, isSimpleDepartment } from "./departments";

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
