import { Fragment, useEffect, useState } from "react";
import { api, type Boot } from "../lib/api";
import { fmtDate, fmtNum, weekdayIdx } from "../lib/format";

const fmtSigned = (n: number) => (n >= 0 ? "+" : "") + fmtNum(n);
import { DataTable, type Row } from "../components/DataTable";
import { usePeriod } from "../hooks/usePeriods";
import { PeriodSelect } from "../components/PeriodPicker";

type MyPeriodData = Awaited<ReturnType<typeof api.myPeriod>>;
type DayEntry = MyPeriodData["entries"][number];
type ProxyEmployee = Awaited<ReturnType<typeof api.proxyEmployees>>[number];
type WeeklyNorm = Record<number, number | string | null | undefined>;

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

export function MinPeriode({ boot }: { boot: Boot }) {
  const [periods, period, setPeriod] = usePeriod();
  const [data, setData] = useState<MyPeriodData | null>(null);
  const me = boot.employee;
  const isLeader = me != null && !!me.is_admin || me != null && !!me.is_manager;
  const [employees, setEmployees] = useState<ProxyEmployee[]>([]);
  const [empId, setEmpId] = useState<number | undefined>(me?.id);
  useEffect(() => {
    if (isLeader) {
      api.proxyEmployees().then(setEmployees).catch(() => {});
    }
  }, [isLeader]);
  const [saldo, setSaldo] = useState<{ start: number; kontrol: number } | null>(null);
  useEffect(() => {
    if (period && empId) {
      api.myPeriod(period.start_date, period.end_date, empId).then(setData);
    }
  }, [period, empId]);
  // ÅTD saldo: Kontrol fra årets første lønperiode til og med den valgte + start saldo.
  const yearStart = periods.filter(p => p.year === period?.year).reduce((min, p) => p.start_date < min ? p.start_date : min, period?.start_date ?? "");
  useEffect(() => {
    setSaldo(null);
    if (period && empId && yearStart) {
      api.atdSaldo(yearStart, period.end_date, empId).then(setSaldo).catch(() => {});
    }
  }, [period, empId, yearStart]);
  if (!period || !data) {
    return <p className="muted">Henter…</p>;
  }
  const byDate: Record<string, DayEntry> = Object.fromEntries(data.entries.map(e => [e.work_date, e]));
  const selected = employees.find(e => e.id === empId);
  const norm = ((selected?.weekly_norm) || boot.weekly_norm || []) as unknown as WeeklyNorm;
  const normFor = (iso: string) => Number(norm[weekdayIdx(iso)] || 0);
  const isSelf = empId === me?.id;
  const who = isSelf ? "Du" : selected?.name || "Medarbejderen";
  const rows: Row[] = [];
  let date = period.start_date;
  let sumWork = 0;
  let sumAbsence = 0;
  let sumControl = 0;
  let sumAllocated = 0;
  while (date <= period.end_date) {
    const entry: DayEntry | undefined = byDate[date];
    const weekend = weekdayIdx(date) >= 5;
    const work = entry?.work_hours != null ? Number(entry.work_hours) : null;
    const absence = entry?.absence_hours != null ? Number(entry.absence_hours) : 0;
    const allocated = Number(data.day_alloc?.[date] || 0);
    // Dagen er ikke fuldt fordelt på projekter.
    const mismatch = work != null && entry?.location && Math.abs(allocated - work) > 0.01;
    if (work != null && entry != null && entry.location) {
      sumWork += work;
      sumAllocated += allocated;
      sumControl += work + absence - normFor(date);
    }
    if (entry?.absence_hours != null) {
      sumAbsence += absence;
    }
    const note = [entry?.location_note, entry?.absence_note, entry?.note].filter(Boolean).join(" · ");
    const cls: Record<string, string> = weekend ? Object.fromEntries(["dato", "sted", "frav", "fravt", "ind", "ud", "arb", "ford", "ktrl", "note"].map(k => [k, "wknd"])) : {
      frav: "gul",
      fravt: "gul",
      ind: "groen",
      ud: "groen",
      arb: "groen",
      ford: mismatch ? "roed" : "groen",
      ktrl: "roed"
    };
    rows.push({
      dato: `${WEEKDAYS[weekdayIdx(date)]} ${date.slice(8, 10)}.${date.slice(5, 7)}`,
      sted: entry?.location || "",
      frav: entry?.absence_type || "",
      fravt: entry?.absence_hours != null ? fmtNum(absence) : "",
      ind: entry?.time_in?.slice(0, 5) || "",
      ud: entry?.time_out?.slice(0, 5) || "",
      arb: work != null ? fmtNum(work) : "",
      ford: work != null && entry != null && entry.location ? mismatch ? `${fmtNum(allocated)} ⚠` : fmtNum(allocated) : "",
      ktrl: work != null && entry != null && entry.location ? (work + absence - normFor(date) >= 0 ? "+" : "") + fmtNum(work + absence - normFor(date)) : "",
      note,
      _cls: cls
    });
    date = new Date(new Date(date + "T12:00:00").getTime() + 86400000).toISOString().slice(0, 10);
  }
  return <div><div className="pagehead"><h2>📅 {isLeader ? "Medarbejder pr. periode" : "Min periode"}</h2><div className="row" style={{
        margin: 0
      }}>{isLeader && <select value={empId} onChange={e => setEmpId(Number(e.target.value))} title="Vælg hvilken medarbejders periode du vil se">{employees.length === 0 && <option value={me!.id}>{me!.name}</option>}{[...employees].sort((a, b) => a.id === me!.id ? -1 : b.id === me!.id ? 1 : a.name.localeCompare(b.name)).map(e => <option value={e.id} key={e.id}>{e.id === me!.id ? `${e.name} (mig)` : e.name}</option>)}</select>}<PeriodSelect periods={periods} sel={period} onChange={setPeriod} /></div></div><DataTable cols={[{
      key: "dato",
      label: "Dato"
    }, {
      key: "sted",
      label: "Sted"
    }, {
      key: "frav",
      label: "Fravær"
    }, {
      key: "fravt",
      label: "Frav.timer",
      num: true
    }, {
      key: "ind",
      label: "Mødt"
    }, {
      key: "ud",
      label: "Gået"
    }, {
      key: "arb",
      label: "Arbejdstid",
      num: true
    }, {
      key: "ford",
      label: "Fordelt",
      num: true
    }, {
      key: "ktrl",
      label: "Kontrol",
      num: true
    }, {
      key: "note",
      label: "Note"
    }]} rows={rows} footer={{
      dato: "I ALT",
      sted: "",
      frav: "betalt fravær:",
      fravt: fmtNum(sumAbsence),
      ind: "",
      ud: "",
      arb: fmtNum(sumWork),
      ford: fmtNum(sumAllocated) + (Math.abs(sumAllocated - sumWork) > 0.01 ? " ⚠" : ""),
      ktrl: (sumControl >= 0 ? "+" : "") + fmtNum(sumControl),
      note: ""
    }} extraFooter={[{
      dato: "ÅTD SALDO",
      sted: "",
      frav: saldo ? <span className="muted small">{`Start saldo ${fmtSigned(saldo.start)} + Kontrol ${fmtSigned(saldo.kontrol)} (${fmtDate(yearStart)} – ${fmtDate(period.end_date)})`}</span> : "",
      fravt: "",
      ind: "",
      ud: "",
      arb: "",
      ford: "",
      ktrl: <span className="saldo">{saldo ? fmtSigned(saldo.start + saldo.kontrol) : "…"}</span>,
      note: ""
    }]} />{Math.abs(sumAllocated - sumWork) > 0.01 && <p className="warn small">⚠ {who} har fordelt {fmtNum(sumAllocated)} af {fmtNum(sumWork)} arbejdstimer på projekter — {isSelf ? "gå til Min tid og fordel resten" : "resten skal fordeles"} på dagene markeret med ⚠.</p>}{data.comp_sums.length > 0 && <Fragment><h3>{isSelf ? "Mine" : `${selected?.name || "Medarbejderens"}s`} timer pr. projekt/selskab</h3><DataTable cols={[{
        key: "comp",
        label: "Projekt/selskab"
      }, {
        key: "h",
        label: "Timer",
        num: true
      }]} rows={data.comp_sums.map(c => ({
        comp: c.comp,
        h: fmtNum(Number(c.h))
      }))} /></Fragment>}</div>;
}
