import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtDate, fmtKr, fmtNum } from "../lib/format";
import { DataTable } from "../components/DataTable";
import { useMultiPeriod } from "../hooks/usePeriods";
import { MultiPeriodPicker } from "../components/PeriodPicker";
import { exportInvoicePdf, hoursByRate, invoiceRows, projectMonthTable, rateCols, rateColumns } from "../lib/invoice";
import { ProjectEconomyView } from "../components/ProjectEconomyView";

type Billing = Awaited<ReturnType<typeof api.ecoBilling>>;

type Props = { flash?: (msg: string) => void };

export function Fakturering({ flash }: Props) {
  const [periods, selIds, setSelIds, sel, reloadPeriods] = useMultiPeriod();
  const [data, setData] = useState<Billing | null>(null);
  const [valgtProjekt, setValgtProjekt] = useState("");

  useEffect(() => {
    if (!sel) {
      return;
    }
    let cancelled = false;
    api.ecoBilling(sel.start_date, sel.end_date).then(res => {
      if (!cancelled) {
        setData(res);
      }
    }).catch((err: Error) => {
      if (!cancelled) {
        flash?.("❌ Kunne ikke hente fakturering: " + err.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sel?.start_date, sel?.end_date]);

  if (!sel || !data) {
    return <p className="muted">Henter…</p>;
  }

  const projektNavne = new Set(data.projekter.map(p => p.comp));
  // Afslutningsprojekter: sorteret efter forventet afregningsdato (uden dato sidst), derefter beløb faldende
  const samlede = data.projekter.filter(p => p.billing === "samlet").sort((a, b) => (a.expected || "9999").localeCompare(b.expected || "9999") || b.kr - a.kr);
  const modtagere = Object.keys(data.invoice).sort();
  const selskabsModtagere = modtagere.filter(m => !projektNavne.has(m));
  const projektModtagere = modtagere.filter(m => projektNavne.has(m));
  const projekt = data.projekter.find(p => p.comp === valgtProjekt) || null;
  const periodeTekst = sel.enkelt ? `Periode: ${sel.month_name} ${sel.year} (${fmtDate(sel.start_date)} – ${fmtDate(sel.end_date)})` : `Perioder: ${sel.month_name} ${sel.year} (${fmtDate(sel.start_date)} – ${fmtDate(sel.end_date)})`;
  const filSuffix = sel.enkelt ? `${sel.month_name.toLowerCase()}_${sel.year}` : `${sel.start_date}_til_${sel.end_date}`;

  const toggleLock = async () => {
    const periode = sel.enkelt;
    if (periode) {
      try {
        await api.setPeriodLock(periode.id, !periode.locked);
        await reloadPeriods();
        // Beskeden bygger på låsestatus FØR skiftet
        flash?.(periode.locked ? `🔓 ${periode.month_name} er åbnet igen` : `🔒 ${periode.month_name} er låst — medarbejdere kan ikke længere rette i perioden`);
      } catch (err) {
        flash?.("❌ " + (err as Error).message);
      }
    }
  };

  const kat = data.kategorier;

  const renderInvoice = (til: string) => {
    const linjer = data.invoice[til];
    const sumT = linjer.reduce((s, l) => s + l.t, 0);
    const sumKr = linjer.reduce((s, l) => s + l.kr, 0);
    const harKilde = linjer.some(l => l.kilde);
    const rates = rateColumns(linjer);
    return <details className="fakt" key={til}><summary><strong>{til}</strong><span className="muted"> — {fmtNum(sumT)} t · {fmtKr(sumKr)} kr</span><button className="ghost pdfbtn" title="Download PDF til videresendelse" onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          exportInvoicePdf({
            til,
            linjer,
            harKilde,
            sumKr,
            periodeTekst,
            filSuffix
          });
        }}>⬇️ PDF</button></summary><DataTable cols={[{
        key: "afd",
        label: "Afdeling"
      }, {
        key: "emp",
        label: "Medarbejder"
      }, {
        key: "ty",
        label: "Opgave"
      }, ...(harKilde ? [{
        key: "kilde",
        label: "Kilde"
      }] : []), ...rateCols(rates), {
        key: "t",
        label: "Timer i alt",
        num: true
      }, {
        key: "kr",
        label: "Beløb (kr)",
        num: true
      }]} rows={invoiceRows(linjer, rates)} footer={{
        afd: "I ALT",
        emp: "",
        ty: "",
        kilde: "",
        ...hoursByRate(linjer, rates),
        t: fmtNum(sumT),
        kr: fmtKr(sumKr)
      }} /></details>;
  };

  return <div><div className="pagehead"><h2>💰 Fakturering</h2><div className="row" style={{
        margin: 0
      }}><MultiPeriodPicker periods={periods} selIds={selIds} onChange={setSelIds} /><button className={sel.enkelt?.locked ? "ghost" : "primary"} disabled={!sel.enkelt} title={sel.enkelt ? "" : "Vælg én enkelt periode for at kunne låse den"} onClick={toggleLock}>{sel.enkelt?.locked ? "🔓 Åbn periode" : "🔒 Lås periode"}</button></div></div><div className="kpis"><div className="kpi"><span>Selskabs-drift-timer</span><strong>{fmtNum(kat.drift.t)} t</strong><em>{fmtKr(kat.drift.kr)} kr</em></div><div className="kpi"><span>Projekt-drift-timer (løbende)</span><strong>{fmtNum(kat.projektLoebende.t)} t</strong><em>{fmtKr(kat.projektLoebende.kr)} kr</em></div><div className="kpi"><span>Projekt-timer til samlet afregning</span><strong>{fmtNum(kat.projektSamlet.t)} t</strong><em>{fmtKr(kat.projektSamlet.kr)} kr</em></div></div><h3>Viderefakturering — timer pr. selskab</h3><DataTable cols={[{
      key: "selskab",
      label: "Selskab"
    }, {
      key: "reg",
      label: "Registreret (t)",
      num: true
    }, {
      key: "fakt",
      label: "Til fakturering (t)",
      num: true
    }, {
      key: "kr",
      label: "Beløb (kr)",
      num: true
    }]} rows={[...data.bill.map(b => ({
      selskab: b.type === "projekt" ? `🧩 ${b.selskab} (drift-projekt)` : b.selskab,
      reg: fmtNum(b.reg_t),
      fakt: fmtNum(b.fakt_t),
      kr: fmtKr(b.fakt_kr)
    })), ...data.parkeret.map(p => ({
      selskab: `🗂️ ${p.selskab} — ${fmtNum(p.t)} t i perioden gemmes til senere afregning${p.expected ? ` (forventet ${fmtDate(p.expected)})` : ""}`,
      reg: "—",
      fakt: "—",
      kr: "—",
      _cls: Object.fromEntries(["selskab", "reg", "fakt", "kr"].map(k => [k, "parkeret"]))
    }))]} footer={{
      selskab: "I ALT (til fakturering nu)",
      reg: fmtNum(data.total.reg_t),
      fakt: fmtNum(data.total.fakt_t),
      kr: fmtKr(data.total.fakt_kr)
    }} />{data.fordelt.t > 0.005 && <p className="muted small">{fmtNum(data.fordelt.t)} t ({fmtKr(data.fordelt.kr)} kr) registreret på drift-projekter er fordelt til selskaberne via fordelingsregler og indgår i "Til fakturering".</p>}<h3>Faktura-grundlag — klar til fakturering</h3><p className="muted small">Én linje pr. medarbejder og opgave — timerne står i kolonnen for deres timepris (100 / 500 / 850 kr), med subtotal pr. afdeling til bogføringen.</p><h4 className="faktgrp">🏢 Selskaber — faktureres for perioden</h4>{selskabsModtagere.length > 0 ? selskabsModtagere.map(renderInvoice) : <p className="muted small">Ingen selskabs-timer i den valgte periode.</p>}{projektModtagere.length > 0 && <><h4 className="faktgrp">🧩 Drift-projekter — faktureres for perioden</h4><p className="muted small">Projekter uden fordelingsregler faktureres direkte til projektets modpart.</p>{projektModtagere.map(renderInvoice)}</>}<h4 className="faktgrp">🗂️ Afslutningsprojekter — gemmes til senere afregning</h4>{samlede.length === 0 ? <p className="muted small">Ingen projekter samler til afslutning lige nu. Sæt Afregning til "Samles til afslutning" på projektet i Settings → Selskaber & projekter — så holdes timerne ude af månedsfakturaen og samles her, indtil projektet aktiveres.</p> : <><p className="muted small">Holdes ude af månedsfakturaen — beløbene er akkumuleret siden projektstart og faktureres/aktiveres først, når projektet afsluttes.</p>{samlede.map(p => <details className="fakt" key={p.comp}><summary><strong>{p.comp}</strong><span className="muted"> — {fmtNum(p.t)} t · {fmtKr(p.kr)} kr optjent{p.expected ? ` · forventes afregnet ${fmtDate(p.expected)}` : " · afregningsdato ikke sat"}</span>{p.lines.length > 0 && <button className="ghost pdfbtn" title="Download PDF med den akkumulerede opgørelse" onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            // sumT sendes med som i originalen, men bruges ikke af PDF-eksporten
            const args = {
              til: p.comp,
              linjer: p.lines,
              harKilde: false,
              sumT: p.t,
              sumKr: p.kr,
              periodeTekst: "Akkumuleret siden projektstart (afregnes ved projektafslutning)" + (p.expected ? ` · forventet afregning ${fmtDate(p.expected)}` : ""),
              filSuffix: "akkumuleret",
              ekstra: projectMonthTable(p)
            };
            exportInvoicePdf(args);
          }}>⬇️ PDF</button>}</summary><ProjectEconomyView p={p} /></details>)}</>}<h3>Projekt-økonomi</h3><details className="fakt projok"><summary><strong>📁 Hvad har projekterne kostet indtil videre?</strong><span className="muted"> — vælg et projekt og se forbruget siden projektstart</span></summary><p className="muted small">Akkumuleret forbrug uafhængigt af den valgte periode — gælder både drift-projekter (faktureres løbende) og afslutningsprojekter (gemmes til aktivering).</p><select value={valgtProjekt} onChange={e => setValgtProjekt(e.target.value)}><option value="">— vælg projekt —</option>{data.projekter.map(p => <option value={p.comp} key={p.comp}>{p.comp} — {fmtNum(p.t)} t · {fmtKr(p.kr)} kr</option>)}</select>{projekt && <div className="projokdetalje"><p><span className="badge">{projekt.billing === "samlet" ? "🗂️ Samlet afregning ved afslutning" : "🔁 Drift — faktureres løbende"}</span> <strong>{fmtNum(projekt.t)} t · {fmtKr(projekt.kr)} kr</strong> siden projektstart{projekt.billing === "samlet" && (projekt.expected ? ` · forventes afregnet ${fmtDate(projekt.expected)}` : " · afregningsdato ikke sat")}{projekt.lines.length > 0 && <button className="ghost pdfbtn" title="Download PDF med projektopgørelsen" onClick={() => {
            const args = {
              til: projekt.comp,
              linjer: projekt.lines,
              harKilde: false,
              sumT: projekt.t,
              sumKr: projekt.kr,
              periodeTekst: "Akkumuleret siden projektstart" + (projekt.billing === "samlet" ? " (afregnes ved projektafslutning)" + (projekt.expected ? ` · forventet afregning ${fmtDate(projekt.expected)}` : "") : " (faktureres løbende)"),
              filSuffix: "akkumuleret",
              ekstra: projectMonthTable(projekt)
            };
            exportInvoicePdf(args);
          }}>⬇️ PDF</button>}</p><ProjectEconomyView p={projekt} visning="opgave" /></div>}</details></div>;
}
