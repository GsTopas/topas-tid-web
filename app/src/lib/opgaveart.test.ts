import { describe, expect, it } from "vitest";
import { artForCompany, companiesForArt, groupTasks, opgaveartEnabled, tasksForArt } from "./opgaveart";

const companies = [{ id: 1, name: "Topas Travel" }, { id: 2, name: "Projekt GL" }, { id: 3, name: "Hotel Icefiord" }];
const companyKinds = { 1: "selskab", 2: "projekt", 3: "selskab" };
const options = ["Testing", "Maintenance & support", "GDPR"];
const taskKinds = { Testing: "projekt", "Maintenance & support": "drift" };

describe("opgaveart", () => {
  it("projekt = projekt, selskab = drift", () => {
    expect(artForCompany("projekt")).toBe("projekt");
    expect(artForCompany("selskab")).toBe("drift");
    expect(artForCompany(undefined)).toBe("");
  });
  it("filtrerer selskaber/projekter efter art", () => {
    expect(companiesForArt("projekt", companies, companyKinds).map(c => c.id)).toEqual([2]);
    expect(companiesForArt("drift", companies, companyKinds).map(c => c.id)).toEqual([1, 3]);
    expect(companiesForArt("", companies, companyKinds)).toHaveLength(3);
  });
  it("projekt: alle opgavetyper (også drift); drift: driftsopgaver + ikke angivet", () => {
    expect(tasksForArt("projekt", options, taskKinds)).toEqual(options);
    expect(tasksForArt("drift", options, taskKinds)).toEqual(["Maintenance & support", "GDPR"]);
    expect(tasksForArt("", options, taskKinds)).toEqual(options);
  });
  it("grupperer i Projektopgaver / Driftsopgaver / Øvrige", () => {
    expect(groupTasks(options, taskKinds)).toEqual([
      { label: "Projektopgaver", options: ["Testing"] },
      { label: "Driftsopgaver", options: ["Maintenance & support"] },
      { label: "Øvrige", options: ["GDPR"] },
    ]);
    expect(groupTasks(["GDPR"], {})).toEqual([{ label: "Øvrige", options: ["GDPR"] }]);
  });
  it("er kun slået til for testerne", () => {
    expect(opgaveartEnabled(1)).toBe(true);
    expect(opgaveartEnabled(2)).toBe(false);
    expect(opgaveartEnabled(null)).toBe(false);
  });
});
