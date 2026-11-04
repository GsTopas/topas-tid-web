import { describe, expect, it } from "vitest";
import { dayNorm, type NormSplit } from "./norm";

const contract = [4, 4, 4, 4, 4, 0, 0];
const fourDays: NormSplit = { employee_id: 1, valid_from: "2026-09-28", weekly_norm: [5, 5, 5, 0, 5, 0, 0] };

describe("dayNorm", () => {
  it("bruger normugens fordeling fra valid_from, når ugesummen passer", () => {
    expect(dayNorm(contract, [fourDays], "2026-10-08")).toBe(0); // torsdag
    expect(dayNorm(contract, [fourDays], "2026-10-05")).toBe(5); // mandag
  });
  it("bruger kontrakten før valid_from", () => {
    expect(dayNorm(contract, [fourDays], "2026-09-24")).toBe(4); // torsdag før
  });
  it("bruger kontrakten, når ugesummen ikke passer", () => {
    expect(dayNorm([7.5, 7.5, 7.5, 7.5, 7, 0, 0], [fourDays], "2026-10-05")).toBe(7.5);
  });
  it("tager den seneste fordeling", () => {
    const later: NormSplit = { employee_id: 1, valid_from: "2026-10-26", weekly_norm: [4, 4, 4, 4, 4, 0, 0] };
    expect(dayNorm(contract, [later, fourDays], "2026-10-29")).toBe(4);
    expect(dayNorm(contract, [later, fourDays], "2026-10-22")).toBe(0);
  });
  it("uden fordelinger: kontrakten", () => {
    expect(dayNorm(contract, null, "2026-10-08")).toBe(4);
  });
  it("normtid med historik: ny normtid gælder kun fra valid_from", () => {
    const old: NormSplit = { employee_id: 1, valid_from: "1900-01-01", weekly_norm: [7, 7, 7, 7, 7, 0, 0], contract: true };
    const nov: NormSplit = { employee_id: 1, valid_from: "2026-10-26", weekly_norm: [6.5, 6.5, 6.5, 6.5, 6, 0, 0], contract: true };
    const contractNow = nov.weekly_norm;
    expect(dayNorm(contractNow, [old, nov], "2026-10-23")).toBe(7); // fredag før
    expect(dayNorm(contractNow, [old, nov], "2026-10-30")).toBe(6); // fredag efter
    expect(dayNorm(contractNow, [old, nov], "2026-10-26")).toBe(6.5);
  });
  it("normugen gælder kun mens dens ugesum passer til normtiden på dagen", () => {
    const old: NormSplit = { employee_id: 1, valid_from: "1900-01-01", weekly_norm: [7, 7, 7, 7, 7, 0, 0], contract: true };
    const nov: NormSplit = { employee_id: 1, valid_from: "2026-10-26", weekly_norm: [6.5, 6.5, 6.5, 6.5, 6, 0, 0], contract: true };
    const split: NormSplit = { employee_id: 1, valid_from: "2026-09-28", weekly_norm: [7.5, 7, 7, 7.25, 6.25, 0, 0] };
    expect(dayNorm(nov.weekly_norm, [old, nov, split], "2026-10-19")).toBe(7.5); // mandag i oktober: normugen (35 t)
    expect(dayNorm(nov.weekly_norm, [old, nov, split], "2026-10-26")).toBe(6.5); // mandag i november: ny normtid (32 t)
  });
});
