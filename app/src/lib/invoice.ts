import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHookData, RowInput } from "jspdf-autotable";
import type { Row } from "../components/DataTable";
import { fmtKr, fmtNum, monthLabel } from "./format";

/** En fakturalinje (medarbejder × opgave [× kilde]) som leveret af api.ecoBilling (`invoice` og `projekter[].lines`). */
export type InvoiceLine = {
  emp: string;
  dept: string;
  ty: string;
  kilde?: string | null;
  rate: number | string | null;
  t: number;
  kr: number;
};

/** Et projekt fra api.ecoBilling's `projekter`. */
export type ProjectEconomy = {
  billing: string;
  t: number;
  kr: number;
  fordeling: { target: string; share: number }[];
  mdr: { md: string; t: number; kr: number }[];
  lines: InvoiceLine[];
};

/** Satser der altid vises som kolonner. */
export const RATE_COLUMNS = [100, 500, 850];

export const rateOf = (line: { rate: number | string | null }): number => Math.round((Number(line.rate) || 0) * 100) / 100;

export const rateColumns = (lines: { rate: number | string | null }[]): number[] =>
  [...new Set([...RATE_COLUMNS, ...lines.map(rateOf)])].sort((a, b) => a - b);

export const rateKey = (rate: number): string => `r_${rate}`;

export const rateLabel = (rate: number): string => `Timer à ${fmtNum(rate)} kr`;

export const rateCols = (rates: number[]) => rates.map(rate => ({
  key: rateKey(rate),
  label: rateLabel(rate),
  num: true
}));

/** Timer summeret pr. sats → { r_<sats>: "1,5" | "" } */
export function hoursByRate(lines: { rate: number | string | null; t: number }[], rates: number[]): Record<string, string> {
  const sums: Record<string, number> = {};
  for (const line of lines) {
    const k = rateKey(rateOf(line));
    sums[k] = (sums[k] || 0) + line.t;
  }
  return Object.fromEntries(rates.map(rate => [rateKey(rate), sums[rateKey(rate)] ? fmtNum(sums[rateKey(rate)]) : ""]));
}

/** Tabelrækker med subtotal pr. afdeling (linjerne forventes sorteret efter afdeling). */
export function invoiceRows(lines: InvoiceLine[], rates: number[]): Row[] {
  const out: Row[] = [];
  const keys = ["afd", "emp", "ty", "kilde", ...rates.map(rateKey), "t", "kr"];
  let dept: string | null = null;
  let group: InvoiceLine[] = [];
  const pushSubtotal = () => {
    if (dept !== null) {
      out.push({
        afd: `Subtotal ${dept || "(uden afdeling)"}`,
        emp: "",
        ty: "",
        kilde: "",
        ...hoursByRate(group, rates),
        t: fmtNum(group.reduce((acc, l) => acc + l.t, 0)),
        kr: fmtKr(group.reduce((acc, l) => acc + l.kr, 0)),
        _cls: Object.fromEntries(keys.map(k => [k, "subtotal"]))
      });
    }
  };
  for (const line of lines) {
    if (dept !== null && line.dept !== dept) {
      pushSubtotal();
      group = [];
    }
    dept = line.dept;
    group.push(line);
    const k = rateKey(rateOf(line));
    out.push({
      afd: line.dept || "",
      emp: line.emp,
      ty: line.ty || "—",
      kilde: line.kilde || "",
      ...Object.fromEntries(rates.map(rate => [rateKey(rate), rateKey(rate) === k ? fmtNum(line.t) : ""])),
      t: fmtNum(line.t),
      kr: fmtKr(line.kr)
    });
  }
  pushSubtotal();
  return out;
}

export type PdfExtraTable = { head: string[]; body: string[][]; foot: string[] };

type ExportArgs = {
  til: string;
  linjer: InvoiceLine[];
  harKilde: boolean;
  sumKr: number;
  periodeTekst: string;
  filSuffix: string;
  ekstra?: PdfExtraTable | null;
};

/** Timeopgørelse som PDF (liggende A4). */
export function exportInvoicePdf({ til, linjer, harKilde, sumKr, periodeTekst, filSuffix, ekstra }: ExportArgs): void {
  const doc = new jsPDF({
    orientation: "landscape"
  });
  doc.setFontSize(16);
  doc.text("Timeopgørelse", 14, 18);
  doc.setFontSize(13);
  doc.text(til, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(periodeTekst, 14, 33);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  doc.text(`Topas Travel · genereret ${dd}.${mm}.${now.getFullYear()}`, 14, 38);
  doc.setTextColor(0);
  const rates = rateColumns(linjer);
  const keys = ["afd", "emp", "ty", ...(harKilde ? ["kilde"] : []), ...rates.map(rateKey), "t", "kr"];
  const head = ["Afdeling", "Medarbejder", "Opgave", ...(harKilde ? ["Kilde"] : []), ...rates.map(rateLabel), "Timer i alt", "Beløb (kr)"];
  const body = invoiceRows(linjer, rates).map(row => keys.map(k => (row[k] ?? "") as string));
  const foot: Record<string, string> = {
    afd: "I ALT",
    ...hoursByRate(linjer, rates),
    t: fmtNum(linjer.reduce((acc, l) => acc + l.t, 0)),
    kr: fmtKr(sumKr)
  };
  let y = 44;
  if (ekstra) {
    autoTable(doc, {
      startY: y,
      head: [ekstra.head],
      body: ekstra.body,
      foot: [ekstra.foot],
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [30, 45, 70]
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: 20,
        fontStyle: "bold"
      },
      columnStyles: Object.fromEntries(ekstra.head.map((_h, i) => i === 0 ? null : [i, {
        halign: "right" as const
      }]).filter((e): e is [number, { halign: "right" }] => Boolean(e)))
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  const numIdx = keys.map((_k, i) => i).filter(i => i >= (harKilde ? 4 : 3));
  autoTable(doc, {
    startY: y,
    head: [head],
    body: body as RowInput[],
    foot: [keys.map(k => foot[k] ?? "")],
    styles: {
      fontSize: 9
    },
    headStyles: {
      fillColor: [30, 45, 70]
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold"
    },
    columnStyles: Object.fromEntries(numIdx.map(i => [i, {
      halign: "right" as const
    }])),
    didParseCell: (data: CellHookData) => {
      if (data.section === "body" && String((data.row.raw as string[])[0]).startsWith("Subtotal")) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [232, 240, 249];
      }
    }
  });
  const slug = til.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "-").replace(/^-+|-+$/g, "");
  doc.save(`timeopgoerelse_${slug}_${filSuffix}.pdf`);
}

/** Månedstabel for et projekt (til PDF'ens ekstra-tabel). */
export function projectMonthTable(p: ProjectEconomy): PdfExtraTable {
  return {
    head: ["Måned", "Timer", "Beløb (kr)", ...p.fordeling.map(f => `${f.target} (${Math.round(f.share * 100)} %)`)],
    body: p.mdr.map(m => [monthLabel(m.md), fmtNum(m.t), fmtKr(m.kr), ...p.fordeling.map(f => fmtKr(Math.round(m.kr * f.share)))]),
    foot: [p.billing === "samlet" ? "VED AFSLUTNING" : "I ALT", fmtNum(p.t), fmtKr(p.kr), ...p.fordeling.map(f => fmtKr(Math.round(p.kr * f.share)))]
  };
}
