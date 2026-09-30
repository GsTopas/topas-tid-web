import { Fragment } from "react";
import { DataTable } from "./DataTable";
import { fmtKr, fmtNum, monthLabel } from "../lib/format";
import { hoursByRate, invoiceRows, rateColumns, rateCols } from "../lib/invoice";
import type { InvoiceLine, ProjectEconomy } from "../lib/invoice";

type Props = {
  p: ProjectEconomy;
  visning?: "medarbejder" | "opgave" | string;
};

type TaskGroup = { ty: string; t: number; kr: number; linjer: InvoiceLine[] };

/** Projektøkonomi: optjent pr. måned + linjer pr. medarbejder eller pr. opgavetype. */
export function ProjectEconomyView({ p, visning = "medarbejder" }: Props) {
  if (p.lines.length === 0) {
    return <p className="muted small">Ingen timer registreret på projektet endnu.</p>;
  }
  const samlet = p.billing === "samlet";
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const rates = rateColumns(p.lines);
  const totalT = p.lines.reduce((acc, l) => acc + l.t, 0);
  const byTask: Record<string, TaskGroup> = {};
  for (const line of p.lines) {
    const ty = line.ty || "—";
    const g = byTask[ty] = byTask[ty] || {
      ty,
      t: 0,
      kr: 0,
      linjer: []
    };
    g.t += line.t;
    g.kr += line.kr;
    g.linjer.push(line);
  }
  const tasks = Object.values(byTask).sort((a, b) => b.kr - a.kr || a.ty.localeCompare(b.ty));
  return <Fragment><h4>Optjent pr. måned{p.fordeling.length > 0 && (samlet ? " — og indirekte fakturering pr. selskab" : " — fordeling efter de gældende regler")}</h4><DataTable cols={[{
      key: "md",
      label: "Måned"
    }, {
      key: "t",
      label: "Timer",
      num: true
    }, {
      key: "kr",
      label: "Beløb (kr)",
      num: true
    }, ...p.fordeling.map(f => ({
      key: "f_" + f.target,
      label: `${f.target} (${Math.round(f.share * 100)} %)`,
      num: true
    }))]} rows={p.mdr.map(m => ({
      md: monthLabel(m.md),
      t: fmtNum(m.t),
      kr: fmtKr(m.kr),
      ...Object.fromEntries(p.fordeling.map(f => ["f_" + f.target, fmtKr(Math.round(m.kr * f.share))]))
    }))} footer={{
      md: samlet ? "VED AFSLUTNING" : "I ALT",
      t: fmtNum(p.t),
      kr: fmtKr(p.kr),
      ...Object.fromEntries(p.fordeling.map(f => ["f_" + f.target, fmtKr(Math.round(p.kr * f.share))]))
    }} />{samlet && p.fordeling.length === 0 && <p className="muted small">Ingen fordelingsregler — slutfakturaen sendes direkte til projektets modpart. Opret regler i Settings → Fordelingsregler, hvis beløbet skal fordeles til selskaber ved aktivering.</p>}{visning === "opgave" ? <Fragment><h4>Pr. opgavetype</h4><DataTable cols={[{
        key: "ty",
        label: "Opgave"
      }, ...rateCols(rates), {
        key: "t",
        label: "Timer i alt",
        num: true
      }, {
        key: "kr",
        label: "Beløb (kr)",
        num: true
      }]} rows={tasks.map(g => ({
        ty: g.ty,
        ...hoursByRate(g.linjer, rates),
        t: fmtNum(round2(g.t)),
        kr: fmtKr(g.kr)
      }))} footer={{
        ty: "I ALT",
        ...hoursByRate(p.lines, rates),
        t: fmtNum(totalT),
        kr: fmtKr(p.kr)
      }} /></Fragment> : <Fragment><h4>Linjer (medarbejder × opgave)</h4><DataTable cols={[{
        key: "afd",
        label: "Afdeling"
      }, {
        key: "emp",
        label: "Medarbejder"
      }, {
        key: "ty",
        label: "Opgave"
      }, ...rateCols(rates), {
        key: "t",
        label: "Timer i alt",
        num: true
      }, {
        key: "kr",
        label: "Beløb (kr)",
        num: true
      }]} rows={invoiceRows(p.lines, rates)} footer={{
        afd: "I ALT",
        emp: "",
        ty: "",
        ...hoursByRate(p.lines, rates),
        t: fmtNum(totalT),
        kr: fmtKr(p.kr)
      }} /></Fragment>}</Fragment>;
}
