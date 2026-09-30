import { useEffect, useState } from "react";
import { api, type SessionEmployee } from "../../lib/api";
import { fmtNum, parseNum } from "../../lib/format";
import { DEPARTMENTS } from "./shared";

type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];
type Budget = Awaited<ReturnType<typeof api.budgetsFor>>[number];

type NewBudget = {
  company_id: Company["id"] | undefined;
  department: string;
  period_type: string;
  hours: string;
};

export function Timepuljer({ flash, emp }: { flash: (msg: string) => void; emp: SessionEmployee | null }) {
  const ownDeptOnly = emp && !emp.is_admin;
  const year = new Date().getFullYear();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [draft, setDraft] = useState<NewBudget | null>(null);
  const load = () => Promise.all([api.companiesAll(), api.budgetsFor(year)]).then(([g, d]) => {
    setCompanies(g);
    setBudgets(d);
  });
  useEffect(() => {
    load();
  }, []);
  if (!budgets) {
    return <p className="muted">Henter…</p>;
  }
  const companyName: Record<string, string> = Object.fromEntries(companies.map(g => [g.id, g.name]));
  // NOTE(recovery): company_id sendes som den er (kan være undefined, hvis der ingen selskaber findes).
  type SaveBudgetArg = Parameters<typeof api.saveBudget>[0];
  return <div><p className="muted">Aftalte timepuljer for {year} pr. selskab og afdeling. Timer/md ganges op til årsmål ×12.</p><table className="datatable admin slim"><thead><tr><th>Selskab</th><th>Afdeling</th><th>Enhed</th><th className="num">Timer</th><th /></tr></thead><tbody>{budgets.map(g => <tr key={g.id}><td>{companyName[g.company_id]}</td><td>{g.department}</td><td>{g.period_type === "month" ? "pr. måned" : "pr. år"}</td><td><input className="hours" defaultValue={fmtNum(Number(g.hours))} onBlur={async d => {
              const w = parseNum(d.target.value);
              if (w != null && w !== Number(g.hours)) {
                try {
                  await api.saveBudget({
                    company_id: g.company_id,
                    department: g.department,
                    year: year,
                    period_type: g.period_type,
                    hours: w,
                    active: g.active
                  });
                  flash("Pulje opdateret ✓");
                  load();
                } catch (b) {
                  flash("❌ " + (b as Error).message);
                }
              }
            }} /></td><td><button className="ghost x" onClick={async () => {
              try {
                await api.deleteBudget(g.id);
                flash("Pulje fjernet");
                load();
              } catch (d) {
                flash("❌ " + (d as Error).message);
              }
            }}>✕</button></td></tr>)}</tbody></table>{draft ? <div className="nyrow"><select value={draft.company_id} onChange={g => setDraft({
        ...draft,
        company_id: Number(g.target.value)
      })}>{companies.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select>{ownDeptOnly ? <span className="muted">{draft.department}</span> : <select value={draft.department} onChange={g => setDraft({
        ...draft,
        department: g.target.value
      })}>{DEPARTMENTS.map(g => <option key={g}>{g}</option>)}</select>}<select value={draft.period_type} onChange={g => setDraft({
        ...draft,
        period_type: g.target.value
      })}><option value="month">timer pr. måned</option><option value="year">timer pr. år</option></select><input className="hours" placeholder="Timer" value={draft.hours} onChange={g => setDraft({
        ...draft,
        hours: g.target.value
      })} /><button className="primary" onClick={async () => {
        try {
          await api.saveBudget({
            company_id: draft.company_id,
            department: draft.department,
            year: year,
            period_type: draft.period_type,
            hours: parseNum(draft.hours) ?? 0,
            active: true
          } as SaveBudgetArg);
          setDraft(null);
          flash("Pulje oprettet ✓");
          load();
        } catch (g) {
          flash("❌ " + (g as Error).message);
        }
      }}>Opret</button><button className="ghost" onClick={() => setDraft(null)}>Fortryd</button></div> : <button className="ghost" onClick={() => setDraft({
      company_id: companies[0]?.id,
      // NOTE(recovery): department kan være null for en leder uden afdeling (som i originalen).
      department: ownDeptOnly ? emp.department as string : "Marketing",
      period_type: "month",
      hours: ""
    })}>➕ Ny pulje</button>}</div>;
}
