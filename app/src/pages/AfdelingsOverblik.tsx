import { useEffect, useMemo, useState } from "react";
import { PeriodSelect } from "../components/PeriodPicker";
import { usePeriod } from "../hooks/usePeriods";
import { api, type SessionEmployee } from "../lib/api";
import { downloadCsv } from "../lib/csv";
import { addDays, approvedByText, fmtDate } from "../lib/format";
import { dayNorm, splitsByEmployee, type NormSplit } from "../lib/norm";

type Matrix = Awaited<ReturnType<typeof api.ecoMatrix>>;
type MatrixEmployee = Matrix["employees"][number];
type MatrixEntry = Matrix["entries"][number];
type Approval = Awaited<ReturnType<typeof api.approvalsForPeriod>>[number];

/** Fraværstype → bogstav i matrixen (`Mj`). */
const ABSENCE_LETTER: Record<string, string> = {
  Ferie: "F",
  "Egen sygdom": "S",
  "Barn syg": "B",
  "Øvrigt fravær": "Ø"
};

/** Afdelingsfilter for økonomi (`Bj`). */
const FILTER_DEPARTMENTS = ["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration"];

type Cell = { c: string; cls: string };
type MatrixRow = {
  emp: MatrixEmployee;
  cells: Cell[];
  mangler: number;
  delvist: number;
  missDates: string[];
};

export function AfdelingsOverblik({ emp, flash }: { emp: SessionEmployee | null; flash?: (msg: string) => void }) {
  const [periods, period, setPeriod] = usePeriod();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [deptFilter, setDeptFilter] = useState("alle");
  const [approvals, setApprovals] = useState<Record<string, Approval>>({});
  /** Normugens dagsfordelinger pr. medarbejder (dagsnormen følger dem, når ugesummen passer). */
  const [splits, setSplits] = useState<Record<number, NormSplit[]>>({});
  useEffect(() => {
    if (period) {
      api.ecoMatrix(period.start_date, period.end_date).then(setMatrix);
    }
  }, [period]);
  useEffect(() => {
    api.normSplits().then(x => setSplits(splitsByEmployee(x))).catch(() => {});
  }, []);
  const loadApprovals = () => {
    if (period) {
      api.approvalsForPeriod(period.id).then(x => {
        const byEmp: Record<string, Approval> = {};
        for (const J of x) {
          byEmp[J.employee_id] = J;
        }
        setApprovals(byEmp);
      }).catch(() => {});
    }
  };
  useEffect(loadApprovals, [period?.id]);
  // Leder-godkendelse: kun leder i medarbejderens egen afdeling
  const canLeaderApprove = (x: MatrixEmployee) => emp != null && !!emp.is_manager && x.department === emp?.department;
  // Økonomi-godkendelse: admin eller leder i Økonomi
  const canEconomyApprove = emp != null && !!emp.is_admin || emp?.department === "Økonomi" && emp != null && !!emp.is_manager;
  // Hover på fluebenene: hvem/hvornår (titlen sidder på cellen, så den også vises over en deaktiveret boks)
  const leaderTitle = (x: MatrixEmployee, a: Approval | undefined) => {
    const hint = canLeaderApprove(x) ? a != null && a.economy_approved ? "Økonomi har låst — lås op dér først" : a != null && a.leader_approved ? "Fjern fluebenet for at åbne perioden for medarbejderen igen" : "Leder-godkend medarbejderens timer for perioden (låser perioden for medarbejderen)" : "Kun lederen i medarbejderens egen afdeling";
    return a != null && a.leader_approved ? approvedByText("Godkendt", a.leader_by_name, a.leader_at) + "\n" + hint : hint;
  };
  const economyTitle = (a: Approval | undefined) => {
    const hint = canEconomyApprove ? a != null && a.leader_approved ? "Lønkør = lås medarbejderens periode" : "Afventer leder-godkendelse" : "Kun ledere i Økonomi (eller admin)";
    return a != null && a.economy_approved ? approvedByText("Lønkørt", a.economy_by_name, a.economy_at) + "\n" + hint : hint;
  };
  const setLeader = async (empId: MatrixEmployee["id"], value: boolean) => {
    try {
      await api.setLeaderApproval(period!.id, empId, value);
      loadApprovals();
    } catch (J) {
      flash?.("❌ " + (J as Error).message);
    }
  };
  const setEconomy = async (empId: MatrixEmployee["id"], value: boolean) => {
    try {
      await api.setEconomyApproval(period!.id, empId, value);
      loadApprovals();
      flash?.(value ? "🔒 Godkendt og låst" : "🔓 Låst op");
    } catch (J) {
      flash?.("❌ " + (J as Error).message);
    }
  };
  const table = useMemo(() => {
    if (!period || !matrix) {
      return null;
    }
    const dates: string[] = [];
    let d = period.start_date;
    while (d <= period.end_date) {
      dates.push(d);
      d = addDays(d, 1);
    }
    const entryByKey: Record<string, MatrixEntry> = {};
    for (const I of matrix.entries) {
      entryByKey[`${I.employee_id}|${I.work_date}`] = I;
    }
    const allocByKey: Record<string, number> = {};
    for (const I of matrix.alloc_sums) {
      allocByKey[`${I.employee_id}|${I.work_date}`] = Number(I.h);
    }
    const rows: MatrixRow[] = matrix.employees.map(I => {
      let mangler = 0;
      let delvist = 0;
      const missDates: string[] = [];
      const cells = dates.map((V): Cell => {
        const W = entryByKey[`${I.id}|${V}`];
        const normHours = dayNorm(I.weekly_norm, splits[I.id], V);
        if (W) {
          if (W.location) {
            const workHours = Number(W.work_hours || 0);
            if (workHours > 0 && Math.abs((allocByKey[`${I.id}|${V}`] || 0) - workHours) <= 0.01) {
              return {
                c: "✓",
                cls: "m-ok"
              };
            } else {
              delvist++;
              return {
                c: "~",
                cls: "m-part"
              };
            }
          }
          return {
            c: ABSENCE_LETTER[W.absence_type as string] || "✓",
            cls: "m-abs"
          };
        }
        if (I.hired_date && V < I.hired_date) {
          return {
            c: "",
            cls: "m-wknd"
          };
        } else if (normHours <= 0) {
          return {
            c: "",
            cls: "m-wknd"
          };
        } else if (V <= matrix.today) {
          mangler++;
          missDates.push(V);
          return {
            c: "!",
            cls: "m-miss"
          };
        } else {
          return {
            c: "",
            cls: ""
          };
        }
      });
      return {
        emp: I,
        cells,
        mangler,
        delvist,
        missDates
      };
    });
    rows.sort((I, D) => D.mangler - I.mangler || D.delvist - I.delvist || I.emp.name.localeCompare(D.emp.name));
    return {
      dates,
      rows
    };
  }, [period, matrix, splits]);
  if (!table) {
    return <p className="muted">Henter…</p>;
  }
  const shown = table.rows.filter(x => deptFilter === "alle" || (x.emp.department || "") === deptFilter);
  const missing = shown.filter(x => x.mangler > 0);
  return <div><div className="pagehead"><h2>📋 Afdelings overblik</h2><div className="row" style={{
        margin: 0
      }}>{emp?.can_economy && <select value={deptFilter} onChange={x => setDeptFilter(x.target.value)}><option value="alle">Alle medarbejdere</option>{FILTER_DEPARTMENTS.map(x => <option value={x} key={x}>{x}</option>)}</select>}<PeriodSelect periods={periods} sel={period} onChange={setPeriod} /></div></div>{missing.length ? <p className="warn">⚠️ Mangler at udfylde: {missing.map(x => x.emp.name).join(", ")} <button className="ghost" onClick={() => downloadCsv(`rykkerliste_${period!.month_name}_${period!.year}.csv`, [{
        key: "navn",
        label: "Medarbejder"
      }, {
        key: "afd",
        label: "Afdeling"
      }, {
        key: "antal",
        label: "Manglende dage"
      }, {
        key: "datoer",
        label: "Datoer"
      }], missing.map(x => ({
        navn: x.emp.name,
        afd: x.emp.department || "",
        antal: x.mangler,
        datoer: x.missDates.map(fmtDate).join(", ")
      })))}>⬇️ Rykkerliste (Excel)</button></p> : <p className="ok">✅ Alle er ajour til dags dato.</p>}<div className="tablewrap"><table className="datatable matrix"><thead><tr><th>Medarbejder</th><th className="godk">Leder ✓</th><th className="godk">Økonomi 🔒</th>{table.dates.map(x => <th className="mday" key={x}>{x.slice(8, 10)}</th>)}<th className="num">Mangler</th><th className="num">Delvist</th></tr></thead><tbody>{shown.map(x => {
            const a = approvals[x.emp.id];
            return <tr key={x.emp.id}><td>{x.emp.name}</td><td className={"godk" + (a != null && a.leader_approved ? " godk-ok" : "")} title={leaderTitle(x.emp, a)}><input type="checkbox" checked={a != null && !!a.leader_approved} disabled={!canLeaderApprove(x.emp) || a != null && !!a.economy_approved} onChange={V => setLeader(x.emp.id, V.target.checked)} /></td><td className={"godk" + (a != null && a.economy_approved ? " godk-laast" : "")} title={economyTitle(a)}><input type="checkbox" checked={a != null && !!a.economy_approved} disabled={!canEconomyApprove || (a == null || !a.leader_approved) && (a == null || !a.economy_approved)} onChange={V => setEconomy(x.emp.id, V.target.checked)} /></td>{x.cells.map((V, W) => <td className={"mcell " + V.cls} key={W}>{V.c}</td>)}<td className={"num" + (x.mangler ? " error" : "")}>{x.mangler}</td><td className={"num" + (x.delvist ? " warn" : "")}>{x.delvist}</td></tr>;
          })}</tbody></table></div><p className="muted small"><b>!</b> intet indtastet · <b>~</b> påbegyndt, fordeling mangler · <b>✓</b> alt fordelt ·<b> F</b> ferie · <b>S</b> sygdom · <b>B</b> barn syg · <b>Ø</b> øvrigt fravær</p><p className="muted small"><b>Godkendelse:</b> Afdelingslederen godkender først (Leder ✓), så kan medarbejderen ikke længere rette i perioden, men lederen kan stadig registrere på vegne af medarbejderen via vælgeren på Min tid. Derefter godkender økonomi (Økonomi 🔒) — det låser perioden for alle. Hold musen over et flueben for at se hvem der har godkendt og hvornår.</p></div>;
}
