import { Fragment, useEffect, useState } from "react";
import { api, type Boot } from "../lib/api";
import { fmtDate, fmtNum, weekdayIdx } from "../lib/format";
import { dayNorm, type NormSplit } from "../lib/norm";
import { hasOncall, hasTaskTracking } from "../lib/departments";
import { isFlexfri, kontrolDay, oncallHours } from "../lib/saldo";
import { absenceLabel, choiceLabel, FLEXFRI } from "./mintid/constants";

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
  const [saldo, setSaldo] = useState<{ start: number; kontrol: number; tilskrevet: number } | null>(null);
  /** Normugens dagsfordelinger for den valgte medarbejder (dagsnormen følger dem, når ugesummen passer). */
  const [splits, setSplits] = useState<NormSplit[]>([]);
  useEffect(() => {
    setSplits([]);
    if (empId) {
      api.normSplits(empId).then(setSplits).catch(() => {});
    }
  }, [empId]);
  useEffect(() => {
    if (period && empId) {
      api.myPeriod(period.start_date, period.end_date, empId).then(setData);
    }
  }, [period, empId]);
  // ÅTD saldo: Kontrol fra årets første lønperiode til og med den valgte + start saldo + tilskrevne timer.
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
  const normFor = (iso: string) => dayNorm(norm, splits, iso);
  const isSelf = empId === me?.id;
  const who = isSelf ? "Du" : selected?.name || "Medarbejderen";
  /** Enkel visning (uden opgavestyring, fx Topas Travel): ingen fordeling på projekter, så kolonnen "Fordelt" udelades. */
  const simple = !hasTaskTracking(isSelf ? me : selected);
  /** Kolonnen "Vagttelefon": for afdelinger med vagttelefon, eller når perioden har vagttelefon-timer. */
  const showOncall = hasOncall(isSelf ? me?.department : selected?.department) || data.entries.some(e => oncallHours(e) > 0);
  const rows: Row[] = [];
  let date = period.start_date;
  let sumWork = 0;
  let sumAbsence = 0;
  let sumControl = 0;
  let sumAllocated = 0;
  let sumOncall = 0;
  while (date <= period.end_date) {
    const entry: DayEntry | undefined = byDate[date];
    const weekend = weekdayIdx(date) >= 5;
    const work = entry?.work_hours != null ? Number(entry.work_hours) : null;
    // Flexfri (kode 51) er ikke fravær: den vises ikke i Fravær/Frav.timer, men trækkes fra i Kontrol.
    const flexfri = isFlexfri(entry);
    const absence = entry?.absence_hours != null && !flexfri ? Number(entry.absence_hours) : 0;
    const control = entry ? kontrolDay(entry, normFor(date)) : null;
    const allocated = Number(data.day_alloc?.[date] || 0);
    // Vagttelefon vises kun i sin egen kolonne; den tæller ikke med i Kontrol eller saldo.
    const oncall = oncallHours(entry);
    sumOncall += oncall;
    // Dagen er ikke fuldt fordelt på projekter.
    const mismatch = work != null && entry?.location && Math.abs(allocated - work) > 0.01;
    if (work != null && entry != null && entry.location) {
      sumWork += work;
      sumAllocated += allocated;
    }
    sumControl += control ?? 0;
    if (entry?.absence_hours != null && !flexfri) {
      sumAbsence += absence;
    }
    // Flexfri står i noten i stedet for i Fravær, så det kan ses hvorfor Kontrol er negativ.
    const flexNote = flexfri ? [`${FLEXFRI} ${fmtNum(Number(entry?.absence_hours ?? 0))} t`, entry?.absence_note].filter(Boolean).join(": ") : "";
    const note = [flexNote, entry?.location_note, entry?.note].filter(Boolean).join(" · ");
    const cls: Record<string, string> = weekend ? Object.fromEntries(["dato", "sted", "frav", "fravt", "ind", "ud", "arb", "vagt", "ford", "ktrl", "note"].map(k => [k, "wknd"])) : {
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
      // Den konkrete fraværstype + valg og fritekst, fx "Andet – firmabetalt · Lægebesøg – egen".
      frav: entry?.absence_type && !flexfri ? [absenceLabel(entry), choiceLabel(entry.absence_choice), entry.absence_note].filter(Boolean).join(" · ") : "",
      fravt: entry?.absence_hours != null && !flexfri ? fmtNum(absence) : "",
      ind: entry?.time_in?.slice(0, 5) || "",
      ud: entry?.time_out?.slice(0, 5) || "",
      arb: work != null ? fmtNum(work) : "",
      vagt: oncall > 0 ? fmtNum(oncall) : "",
      ford: work != null && entry != null && entry.location ? mismatch ? `${fmtNum(allocated)} ⚠` : fmtNum(allocated) : "",
      ktrl: control != null ? fmtSigned(control) : "",
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
    }, ...(showOncall ? [{
      key: "vagt",
      label: "Vagttelefon",
      num: true
    }] : []), ...(simple ? [] : [{
      key: "ford",
      label: "Fordelt",
      num: true
    }]), {
      key: "ktrl",
      label: "Kontrol",
      num: true
    }, {
      key: "note",
      label: "Note"
    }]} rows={rows} footer={{
      dato: "I ALT",
      sted: "",
      frav: "fravær i alt:",
      fravt: fmtNum(sumAbsence),
      ind: "",
      ud: "",
      arb: fmtNum(sumWork),
      vagt: fmtNum(sumOncall),
      ford: fmtNum(sumAllocated) + (Math.abs(sumAllocated - sumWork) > 0.01 ? " ⚠" : ""),
      ktrl: (sumControl >= 0 ? "+" : "") + fmtNum(sumControl),
      note: ""
    }} extraFooter={[{
      dato: "ÅTD SALDO",
      sted: "",
      frav: saldo ? <span className="muted small">{`Start saldo ${fmtSigned(saldo.start)} + Kontrol ${fmtSigned(saldo.kontrol)}${saldo.tilskrevet ? ` + Tilskrevet ${fmtSigned(saldo.tilskrevet)}` : ""} (${fmtDate(yearStart)} – ${fmtDate(period.end_date)})`}</span> : "",
      fravt: "",
      ind: "",
      ud: "",
      arb: "",
      vagt: "",
      ford: "",
      ktrl: <span className="saldo">{saldo ? fmtSigned(saldo.start + saldo.kontrol + saldo.tilskrevet) : "…"}</span>,
      note: ""
    }]} />{!simple && Math.abs(sumAllocated - sumWork) > 0.01 && <p className="warn small">⚠ {who} har fordelt {fmtNum(sumAllocated)} af {fmtNum(sumWork)} arbejdstimer på projekter — {isSelf ? "gå til Min tid og fordel resten" : "resten skal fordeles"} på dagene markeret med ⚠.</p>}{!simple && data.comp_sums.length > 0 && <Fragment><h3>{isSelf ? "Mine" : `${selected?.name || "Medarbejderens"}s`} timer pr. projekt/selskab</h3><DataTable cols={[{
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
