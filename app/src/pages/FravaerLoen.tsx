import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { addDays, fmtDate, fmtNum, weekdayIdx } from "../lib/format";
import { HALF_HOLIDAY, holidayDays } from "../lib/ferie";
import { downloadCsv } from "../lib/csv";
import { DataTable } from "../components/DataTable";
import { useMultiPeriod } from "../hooks/usePeriods";
import { MultiPeriodPicker } from "../components/PeriodPicker";

type Absence = Awaited<ReturnType<typeof api.ecoAbsence>>;
type AbsenceCode = Awaited<ReturnType<typeof api.absenceCodes>>[number];
type WeeklyNorm = Record<number, number | string | null | undefined>;

type EmpStats = {
  afd: string;
  arb: number;
  ferie: number;
  syg: number;
  barn: number;
  "øvr": number;
  flex: number;
  reg: number;
  _wn: WeeklyNorm;
  _hired: string | null;
  norm?: number;
};

type FravaerRow = {
  eid: number;
  iso: string;
  emp: string;
  nr: string | number;
  afd: string;
  dato: string;
  type: string;
  valg: string;
  kodeTxt: string;
  timer: string;
  omfang: string;
  note: string;
};

export function FravaerLoen() {
  const [periods, selIds, setSelIds, sel] = useMultiPeriod();
  const [absence, setAbsence] = useState<Absence | null>(null);
  const [codes, setCodes] = useState<AbsenceCode[]>([]);

  const load = () => {
    if (sel) {
      api.ecoAbsence(sel.start_date, sel.end_date).then(setAbsence);
    }
  };
  useEffect(load, [sel?.start_date, sel?.end_date]);
  useEffect(() => {
    api.absenceCodes().then(setCodes).catch(() => {});
  }, []);

  const setCode = async (empId: number, iso: string, code: string) => {
    try {
      await api.setAbsenceCode(empId, iso, code);
      load();
    } catch (err) {
      alert("Kunne ikke sætte lønkode: " + (err as Error).message);
    }
  };

  const computed = useMemo(() => {
    if (!absence || !sel) {
      return null;
    }
    const stats: Record<string, EmpStats> = {};
    const fravaer: FravaerRow[] = [];
    for (const e of absence.entries) {
      const s = stats[e.emp_name] = stats[e.emp_name] || {
        afd: e.department || "",
        arb: 0,
        ferie: 0,
        syg: 0,
        barn: 0,
        "øvr": 0,
        flex: 0,
        reg: 0,
        _wn: e.weekly_norm as WeeklyNorm,
        _hired: e.hired_date
      };
      const fravaerTimer = e.absence_hours != null ? Number(e.absence_hours) : 0;
      const dagsNorm = Number((e.weekly_norm as WeeklyNorm)[weekdayIdx(e.work_date)] || 0);
      if (e.work_hours != null && e.location) {
        const arbTimer = Number(e.work_hours);
        s.arb += arbTimer;
        s.reg += arbTimer + fravaerTimer;
        s.flex += arbTimer + fravaerTimer - dagsNorm;
      } else if (e.absence_type) {
        // Hel fraværsdag uden angivne timer tæller som dagens norm
        s.reg += e.absence_hours != null ? fravaerTimer : dagsNorm;
      }
      if (e.absence_type === "Ferie") {
        // ½ feriedag (ferie på en arbejdsdag) tæller 0,5
        s.ferie += holidayDays(e);
      } else if (e.absence_type === "Egen sygdom") {
        s.syg += fravaerTimer;
      } else if (e.absence_type === "Barn syg") {
        s.barn += fravaerTimer;
      } else if (e.absence_type === "Øvrigt fravær") {
        s["øvr"] += fravaerTimer;
      }
      if (e.absence_type) {
        fravaer.push({
          eid: e.employee_id,
          iso: e.work_date,
          emp: e.emp_name,
          nr: e.payroll_number ?? "",
          afd: e.department || "",
          dato: fmtDate(e.work_date),
          type: e.absence_type === "Ferie" && e.location ? HALF_HOLIDAY : e.absence_type,
          valg: e.absence_choice || "",
          kodeTxt: e.absence_code || "",
          timer: e.absence_hours != null ? fmtNum(fravaerTimer) : "",
          omfang: e.location ? "Delvis (arbejdede også)" : "Hel dag",
          note: [e.location_note, e.absence_note, e.note].filter(Boolean).join(" · ")
        });
      }
    }
    // Norm: sum af ugenormen for hver dag i perioden, fra ansættelsesdatoen
    for (const s of Object.values(stats)) {
      let norm = 0;
      for (let d = sel.start_date; d <= sel.end_date; d = addDays(d, 1)) {
        if (!s._hired || !(d < s._hired)) {
          norm += Number(s._wn[weekdayIdx(d)] || 0);
        }
      }
      s.norm = norm;
    }
    return {
      stats,
      fravaer
    };
  }, [absence, sel?.start_date, sel?.end_date]);

  if (!sel || !computed) {
    return <p className="muted">Henter…</p>;
  }
  const ytd = Object.fromEntries((absence!.ytd || []).map(y => [y.emp_name, y]));

  return <div><div className="pagehead"><h2>🏖️ Fravær & løn</h2><MultiPeriodPicker periods={periods} selIds={selIds} onChange={setSelIds} /></div><h3>Saldi pr. medarbejder</h3><p className="muted small">Norm (t) = periodens normtimer ("enheder" på lønsedlen) · Registreret (t) = arbejde + fravær i alt.{absence!.ferieaar_start && <> · Feriedage i ferieåret tælles fra <b>{fmtDate(absence!.ferieaar_start)}</b> (dansk ferieår 1.9–31.8).</>}</p><DataTable cols={[{
      key: "navn",
      label: "Medarbejder"
    }, {
      key: "afd",
      label: "Afdeling"
    }, {
      key: "norm",
      label: "Norm (t)",
      num: true
    }, {
      key: "reg",
      label: "Registreret (t)",
      num: true
    }, {
      key: "arb",
      label: "Arbejdstimer",
      num: true
    }, {
      key: "ferie",
      label: "Feriedage",
      num: true
    }, {
      key: "syg",
      label: "Egen sygdom (t)",
      num: true
    }, {
      key: "barn",
      label: "Barn syg (t)",
      num: true
    }, {
      key: "øvr",
      label: "Øvrigt (t)",
      num: true
    }, {
      key: "flex",
      label: "Flex",
      num: true
    }, {
      key: "ferieår",
      label: "Feriedage i ferieåret",
      num: true
    }]} rows={Object.entries(computed.stats).map(([navn, s]) => ({
      navn,
      afd: s.afd,
      norm: fmtNum(s.norm),
      reg: fmtNum(s.reg),
      arb: fmtNum(s.arb),
      ferie: fmtNum(s.ferie),
      syg: fmtNum(s.syg),
      barn: fmtNum(s.barn),
      "øvr": fmtNum(s["øvr"]),
      flex: (s.flex >= 0 ? "+" : "") + fmtNum(s.flex),
      "ferieår": fmtNum(Number(ytd[navn]?.ferie_ytd || 0))
    }))} /><h3>Fraværsliste — til indberetning <button className="ghost" onClick={() => downloadCsv(`fravaersliste_${sel.month_name}_${sel.year}.csv`, [{
        key: "nr",
        label: "Medarbejdernr"
      }, {
        key: "emp",
        label: "Medarbejder"
      }, {
        key: "afd",
        label: "Afdeling"
      }, {
        key: "dato",
        label: "Dato"
      }, {
        key: "type",
        label: "Type"
      }, {
        key: "valg",
        label: "Valg"
      }, {
        key: "kodeTxt",
        label: "Lønkode"
      }, {
        key: "timer",
        label: "Timer"
      }, {
        key: "omfang",
        label: "Omfang"
      }, {
        key: "note",
        label: "Note"
      }], computed.fravaer)}>⬇️ Excel</button></h3><p className="muted small"><b>Lønkode:</b> Barn syg (20) og Andet fravær (50/51) kodes automatisk. Sygdom (10 vs. § 56/13) og Ferie (2200 vs. feriefridage/2300) vurderes af økonomi her — koden kommer med i udtrækket.</p><DataTable cols={[{
      key: "nr",
      label: "Nr."
    }, {
      key: "emp",
      label: "Medarbejder"
    }, {
      key: "afd",
      label: "Afdeling"
    }, {
      key: "dato",
      label: "Dato"
    }, {
      key: "type",
      label: "Type"
    }, {
      key: "valg",
      label: "Valg"
    }, {
      key: "kode",
      label: "Lønkode"
    }, {
      key: "timer",
      label: "Timer",
      num: true
    }, {
      key: "omfang",
      label: "Omfang"
    }, {
      key: "note",
      label: "Note"
    }]} rows={computed.fravaer.map(f => ({
      ...f,
      kode: <select className="kodesel" value={f.kodeTxt} onChange={e => setCode(f.eid, f.iso, e.target.value)}><option value="">— vælg —</option>{codes.map(c => <option value={c.code} key={c.code}>{c.code} · {c.label}</option>)}</select>
    }))} /></div>;
}
