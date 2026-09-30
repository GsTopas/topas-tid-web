import { describe, expect, it } from "vitest";
import { meetsPasswordRules, randomTempPassword } from "../pages/settings/shared";

describe("midlertidigt password", () => {
  it("opfylder altid Supabase-reglen (bogstav + tal)", () => {
    for (let i = 0; i < 2000; i++) {
      const pw = randomTempPassword();
      expect(pw).toMatch(/^Topas-[A-Za-z2-9]{10}$/);
      expect(meetsPasswordRules(pw)).toBe(true);
    }
  });
  it("afviser passwords uden tal eller bogstav", () => {
    expect(meetsPasswordRules("Topas-abcdefgh")).toBe(false);
    expect(meetsPasswordRules("12345678")).toBe(false);
    expect(meetsPasswordRules("abc1")).toBe(false);
    expect(meetsPasswordRules("sommer2026")).toBe(true);
  });
});
