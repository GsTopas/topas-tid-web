import { Fragment, useEffect, useMemo, useState } from "react";
import { api, type SessionEmployee, type SharedProjectRow } from "../lib/api";
import { fmtKr, fmtNum, MONTHS, parseNum } from "../lib/format";
import { DataTable } from "../components/DataTable";

type DepartmentData = Awaited<ReturnType<typeof api.department>>;
type DeptRow = DepartmentData["rows"][number];

/** Farver til de 7 største opgavetyper; index 7 = øvrige. */
const TYPE_COLORS = ["#6fc3e8", "#e8905a", "#8bd17c", "#d17cc7", "#f2d05a", "#7c8bd1", "#5ad1c2", "#9aa3b3"];

const NO_TASK_TYPE = "(uden opgavetype)";

/** Valgt segment i diagrammet: enten én type på tværs (ingen comp) eller type × virksomhed. */
type Selection = { comp?: string; ty: string };

export function AfdelingsIndsigt({ emp }: { emp: SessionEmployee }) {
  const year = new Date().getFullYear();
  const [dept, setDept] = useState<string | null>(emp.can_economy ? "Marketing" : emp.department);
  const [month, setMonth] = useState(0);
  const [data, setData] = useState<DepartmentData | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [shared, setShared] = useState<SharedProjectRow[]>([]);
  const reload = () => {
    if (dept) {
      api.department(year, emp.can_economy ? dept : undefined).then(setData);
      // Fælles projekter er et tillæg: fejler kaldet, vises siden bare uden.
      api.departmentShared(year, emp.can_economy ? dept : undefined).then(setShared, () => setShared([]));
    }
  };
  useEffect(reload, [dept]);
  useEffect(() => {
    setSel(null);
  }, [dept, month]);
  const canEditPlan = emp.is_admin || emp.is_manager && emp.department === dept;
  const [planInput, setPlanInput] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) {
      return;
    }
    const next: Record<string, string> = {};
    for (const p of data.plan) {
      next[`${p.company_id}|${p.month}`] = fmtNum(Number(p.hours));
    }
    setPlanInput(next);
  }, [data]);
  const stats = useMemo(() => {
    if (!data) {
      return null;
    }
    const rows: DeptRow[] = month ? data.rows.filter(r => Number(r.work_date.slice(5, 7)) === month) : data.rows;
    const total = rows.reduce((s, r) => s + Number(r.hours), 0);
    const totalKr = rows.reduce((s, r) => s + Number(r.kr ?? 0), 0);
    const perComp: Record<string, number> = {};
    const perType: Record<string, number> = {};
    const compType: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const h = Number(r.hours);
      perComp[r.comp_name] = (perComp[r.comp_name] || 0) + h;
      const ty = r.task_type || NO_TASK_TYPE;
      perType[ty] = (perType[ty] || 0) + h;
      compType[r.comp_name] = compType[r.comp_name] || {};
      compType[r.comp_name][ty] = (compType[r.comp_name][ty] || 0) + h;
    }
    const topTyper = Object.entries(perType).sort((a, b) => b[1] - a[1]).map(([ty]) => ty).slice(0, 7);
    return {
      rows,
      total,
      totalKr,
      perComp,
      perType,
      compType,
      topTyper
    };
  }, [data, month]);
  // Fælles projekter: kun projekter hvor mindst én anden afdeling har timer i den valgte periode.
  const sharedProjects = useMemo(() => {
    const own = data?.dept ?? dept;
    const byComp = new Map<string, Map<string, { h: number; kr: number }>>();
    for (const r of shared) {
      if (month && r.month !== month) {
        continue;
      }
      const depts = byComp.get(r.comp_name) ?? new Map<string, { h: number; kr: number }>();
      const cur = depts.get(r.department) ?? { h: 0, kr: 0 };
      cur.h += r.hours;
      cur.kr += r.kr;
      depts.set(r.department, cur);
      byComp.set(r.comp_name, depts);
    }
    return [...byComp.entries()]
      .filter(([, depts]) => [...depts.keys()].some(d => d !== own))
      .map(([comp, depts]) => {
        const lines = [...depts.entries()].map(([d, v]) => ({ dept: d, ...v })).sort((a, b) => b.h - a.h);
        return {
          comp,
          lines,
          h: lines.reduce((s, l) => s + l.h, 0),
          kr: lines.reduce((s, l) => s + l.kr, 0)
        };
      })
      .sort((a, b) => b.h - a.h);
  }, [shared, month, data, dept]);
  const selStats = useMemo(() => {
    if (!sel || !stats) {
      return null;
    }
    const rows = stats.rows.filter(r => (!sel.comp || r.comp_name === sel.comp) && (r.task_type || NO_TASK_TYPE) === sel.ty);
    return {
      rows,
      t: rows.reduce((s, r) => s + Number(r.hours), 0),
      kr: rows.reduce((s, r) => s + Number(r.kr ?? 0), 0),
      comps: new Set(rows.map(r => r.comp_name)).size
    };
  }, [sel, stats]);
  if (!dept) {
    return <p className="muted">Du er ikke tilknyttet en afdeling — kontakt admin.</p>;
  }
  if (!data || !stats) {
    return <p className="muted">Henter…</p>;
  }
  const comps = Object.entries(stats.perComp).sort((a, b) => b[1] - a[1]);
  const maxComp = comps[0]?.[1] || 1;
  const colorOf = (ty: string) => {
    const idx = stats.topTyper.indexOf(ty);
    return TYPE_COLORS[idx === -1 ? 7 : idx];
  };
  const planPerComp: Record<string, number> = {};
  for (const p of data.plan) {
    planPerComp[p.comp_name] = (planPerComp[p.comp_name] || 0) + Number(p.hours);
  }
  // Forbrug til timepuljer regnes altid på hele året (data.rows), uanset valgt måned.
  const usedPerComp: Record<string, number> = {};
  for (const r of data.rows) {
    usedPerComp[r.comp_name] = (usedPerComp[r.comp_name] || 0) + Number(r.hours);
  }
  return <div><div className="pagehead"><h2>👥 Afdelings indsigt</h2><div className="row" style={{
        margin: 0
      }}>{emp.can_economy && <select value={dept} onChange={e => setDept(e.target.value)}>{["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration"].map(d => <option key={d}>{d}</option>)}</select>}<select value={month} onChange={e => setMonth(Number(e.target.value))}><option value={0}>Hele året {year}</option>{MONTHS.map((m, i) => <option value={i + 1} key={m}>{m}</option>)}</select></div></div><div className="kpis"><div className="kpi"><span>Timer</span><strong>{fmtNum(selStats ? selStats.t : stats.total)}</strong>{selStats && <em>af {fmtNum(stats.total)} i alt ({stats.total > 0 ? Math.round(selStats.t / stats.total * 100) : 0} %)</em>}</div><div className="kpi"><span>Værdi (kr)</span><strong>{fmtKr(selStats ? selStats.kr : stats.totalKr)}</strong>{selStats && <em>af {fmtKr(stats.totalKr)} i alt</em>}</div><div className="kpi"><span>Virksomheder & projekter</span><strong>{selStats ? selStats.comps : comps.length}</strong>{selStats && <em>berørt af valget</em>}</div></div>{selStats && <p className="muted small">Viser: <b>{sel!.comp ? `${sel!.comp} · ${sel!.ty}` : sel!.ty}</b> — klik samme sted igen (eller ✕ i panelet) for at se hele afdelingen.</p>}<h3>Hvad har vi lavet — og for hvem?</h3><div className="hbars">{comps.map(([comp, compHours]) => <div className="hbar" key={comp}><span className="lbl" title={comp}>{comp}</span><div className="bar">{Object.entries(stats.compType[comp]).sort((a, b) => b[1] - a[1]).map(([ty, h]) => {
            const isSel = sel && (sel.comp ? sel.comp === comp && sel.ty === ty : sel.ty === ty);
            return <div className={"seg" + (sel ? isSel ? " seg-sel" : " seg-dim" : "")} title={`${ty}: ${fmtNum(h)} t (${Math.round(h / compHours * 100)} % af ${comp})`} onClick={() => setSel(isSel && sel.comp ? null : {
              comp,
              ty
            })} style={{
              width: `${h / maxComp * 100}%`,
              background: colorOf(ty)
            }} key={ty} />;
          })}</div><span className="val">{fmtNum(compHours)} t</span></div>)}</div><div className="legend">{stats.topTyper.map(ty => {
        const isSel = sel && !sel.comp && sel.ty === ty;
        return <span className={"legenditem" + (isSel ? " sel" : "")} onClick={() => setSel(isSel ? null : {
          ty
        })} key={ty}><i style={{
            background: colorOf(ty)
          }} /> {ty}</span>;
      })}</div>{sel && (() => {
      const rows = stats.rows.filter(r => (!sel.comp || r.comp_name === sel.comp) && (r.task_type || NO_TASK_TYPE) === sel.ty);
      const t = rows.reduce((s, r) => s + Number(r.hours), 0);
      const kr = rows.reduce((s, r) => s + Number(r.kr ?? 0), 0);
      const latest = [...rows].reverse().slice(0, 10);
      return <div className="segdetail"><div className="seghead"><strong><i style={{
              background: colorOf(sel.ty)
            }} />{sel.comp ? `${sel.comp} · ${sel.ty}` : sel.ty}</strong><button className="ghost x" onClick={() => setSel(null)}>✕</button></div><p className="segtal"><b>{fmtNum(t)} t</b> · {fmtKr(kr)} kr{sel.comp && stats.perComp[sel.comp] > 0 && ` · ${Math.round(t / stats.perComp[sel.comp] * 100)} % af ${sel.comp}`}{stats.total > 0 && ` · ${Math.round(t / stats.total * 100)} % af afdelingen`}</p><DataTable cols={[{
          key: "dato",
          label: "Dato"
        }, {
          key: "emp",
          label: "Medarbejder"
        }, ...(sel.comp ? [] : [{
          key: "comp",
          label: "Virksomhed/projekt"
        }]), {
          key: "t",
          label: "Timer",
          num: true
        }, {
          key: "note",
          label: "Opgavenote"
        }]} rows={latest.map(r => ({
          dato: `${r.work_date.slice(8, 10)}.${r.work_date.slice(5, 7)}`,
          emp: r.emp_name,
          comp: r.comp_name,
          t: fmtNum(Number(r.hours)),
          note: r.task_note || ""
        }))} />{rows.length > 10 && <p className="muted small">…og {rows.length - 10} ældre linjer (se Alle linjer nederst)</p>}</div>;
    })()}{sharedProjects.length > 0 && <Fragment><h3>Fælles projekter med andre afdelinger</h3><p className="muted small">Projekter {data.dept} har timer på, hvor andre afdelinger også har registreret tid. Kun totaler pr. afdeling.</p>{sharedProjects.map(p => <div className="pulje" key={p.comp}><div className="puljehead"><strong>{p.comp}</strong><span className="muted">{fmtNum(p.h)} t · {fmtKr(p.kr)} kr i alt</span></div><DataTable cols={[{
          key: "afd",
          label: "Afdeling"
        }, {
          key: "t",
          label: "Timer",
          num: true
        }, {
          key: "kr",
          label: "Kr",
          num: true
        }, {
          key: "andel",
          label: "Andel",
          num: true
        }]} rows={p.lines.map(l => ({
          afd: l.dept === data.dept ? <b>{l.dept} (jer)</b> : l.dept,
          t: fmtNum(l.h),
          kr: fmtKr(l.kr),
          andel: p.h > 0 ? `${Math.round(l.h / p.h * 100)} %` : ""
        }))} /></div>)}</Fragment>}{data.budgets.length > 0 && <Fragment><h3>Timepuljer & årsplan</h3>{data.budgets.map(b => {
        // Månedspuljer ganges op til et helt år.
        const poolHours = Number(b.hours) * (b.period_type === "month" ? 12 : 1);
        const used = usedPerComp[b.comp_name] || 0;
        const pct = Math.min(used / poolHours * 100, 100);
        return <div className="pulje" key={b.comp_name}><div className="puljehead"><strong>{b.comp_name}</strong><span className="muted">{fmtNum(used)} af {fmtNum(poolHours)} t brugt i {year}{planPerComp[b.comp_name] ? ` · plan: ${fmtNum(planPerComp[b.comp_name])} t` : ""}</span></div><div className="progressbar"><div style={{
              width: `${pct}%`,
              background: used > poolHours ? "#ff7b73" : pct >= 85 ? "var(--warn)" : "var(--ice)"
            }} /></div></div>;
      })}</Fragment>}{canEditPlan && data.budgets.length > 0 && <details className="planedit"><summary>✏️ Redigér månedsplan {year}</summary><div className="tablewrap"><table className="datatable admin slim"><thead><tr><th>Selskab</th>{MONTHS.map(m => <th className="num" key={m}>{m.slice(0, 3)}</th>)}</tr></thead><tbody>{data.budgets.map(b => <tr key={b.company_id}><td>{b.comp_name}</td>{MONTHS.map((_m, i) => {
                const key = `${b.company_id}|${i + 1}`;
                return <td key={key}><input className="hours mini" value={planInput[key] || ""} onChange={e => setPlanInput({
                    ...planInput,
                    [key]: e.target.value
                  })} /></td>;
              })}</tr>)}</tbody></table></div><button className="primary" onClick={async () => {
        const items: { company_id: number; month: number; hours: number }[] = [];
        for (const [key, value] of Object.entries(planInput)) {
          const hours = parseNum(value);
          if (hours == null) {
            continue;
          }
          const [companyId, m] = key.split("|");
          items.push({
            company_id: Number(companyId),
            month: Number(m),
            hours
          });
        }
        try {
          await api.savePlan(dept, year, items);
          reload();
        } catch (err) {
          alert("Kunne ikke gemme planen: " + (err as Error).message);
        }
      }}>💾 Gem månedsplan</button></details>}<h3>Alle linjer</h3><DataTable cols={[{
      key: "dato",
      label: "Dato"
    }, {
      key: "emp",
      label: "Medarbejder"
    }, {
      key: "comp",
      label: "Virksomhed/projekt"
    }, {
      key: "ty",
      label: "Opgavetype"
    }, {
      key: "t",
      label: "Timer",
      num: true
    }, {
      key: "note",
      label: "Opgavenote"
    }]} rows={[...stats.rows].reverse().map(r => ({
      dato: `${r.work_date.slice(8, 10)}.${r.work_date.slice(5, 7)}`,
      emp: r.emp_name,
      comp: r.comp_name,
      ty: r.task_type || "",
      t: fmtNum(Number(r.hours)),
      note: r.task_note || ""
    }))} /></div>;
}
