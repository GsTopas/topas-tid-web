import { describe, expect, it } from "vitest";
import { FORDELINGSKATEGORIER, makeKategoriOpslag } from "./fordelingskategori";
import { invoiceRows } from "./invoice";

describe("fordelingskategori", () => {
  const opslag = makeKategoriOpslag([
    { department: "IT", name: "Support", distribution_category: FORDELINGSKATEGORIER[8] },
    { department: "Marketing", name: "Support", distribution_category: FORDELINGSKATEGORIER[0] },
    { department: "IT", name: "Konsulent", distribution_category: null },
  ]);

  it("slår op pr. afdeling og opgavetype", () => {
    expect(opslag("IT", "Support")).toBe("8. Vedligehold og videreførelse af eksisterende funktionalitet");
    expect(opslag("Marketing", "Support")).toBe("Undersøgelse af muligheder");
    expect(opslag("IT", "Konsulent")).toBe("");
    expect(opslag("Økonomi", "Support")).toBe("");
  });

  it("fylder kolonnen kat i fakturalinjerne, tom i subtotaler og uden opslag", () => {
    const lines = [{ emp: "Jan", dept: "IT", ty: "Support", kilde: null, rate: 500, t: 1, kr: 500 }];
    const rows = invoiceRows(lines, [500], opslag);
    expect(rows[0].kat).toBe("8. Vedligehold og videreførelse af eksisterende funktionalitet");
    expect(rows[1].kat).toBe("");
    expect(invoiceRows(lines, [500])[0].kat).toBe("");
  });
});
