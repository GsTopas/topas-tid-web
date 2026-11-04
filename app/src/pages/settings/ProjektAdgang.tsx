import { Fragment, useEffect, useState } from "react";
import { api } from "../../lib/api";

type Employee = Awaited<ReturnType<typeof api.employeesAll>>[number];
type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];

/**
 * Settings → Adgang: hvilke selskaber og projekter en medarbejder kan vælge under Min tid.
 * Ét adgangssæt (`employee_companies`) for begge slags; vist i to sektioner så
 * selskabsadgang ikke ligger gemt under "projekter". Alle markeret = fri adgang (ingen rækker).
 */
export function ProjektAdgang({ flash, onChanged }: { flash: (msg: string) => void; onChanged: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [empId, setEmpId] = useState("");
  const [checked, setChecked] = useState<Set<Company["id"]>>(new Set());
  useEffect(() => {
    Promise.all([api.employeesAll(), api.companiesAll()]).then(([h, p]) => {
      setEmployees(h.filter(g => g.active));
      setCompanies(p.filter(g => g.active));
    });
  }, []);
  useEffect(() => {
    if (empId) {
      api.accessFor(Number(empId)).then(h => {
        // Ingen rækker = fri adgang → alle markeret
        setChecked(new Set(h.length ? h.map(p => p.company_id) : companies.map(p => p.id)));
      });
    }
  }, [empId, companies]);
  const toggle = (id: Company["id"], on: boolean) => {
    const g = new Set(checked);
    if (on) {
      g.add(id);
    } else {
      g.delete(id);
    }
    setChecked(g);
  };
  const setAll = (list: Company[], on: boolean) => {
    const g = new Set(checked);
    list.forEach(c => (on ? g.add(c.id) : g.delete(c.id)));
    setChecked(g);
  };
  const selskaber = companies.filter(c => c.kind !== "projekt");
  const projekter = companies.filter(c => c.kind === "projekt");
  const section = (title: string, list: Company[]) => <Fragment>
      <h3>{title} <span className="muted small">({list.filter(c => checked.has(c.id)).length} af {list.length} valgt)</span> <button className="ghost" onClick={() => setAll(list, true)}>Vælg alle</button> <button className="ghost" onClick={() => setAll(list, false)}>Fravælg alle</button></h3>
      {list.length ? <div className="checkgrid">{list.map(h => <label key={h.id}><input type="checkbox" checked={checked.has(h.id)} onChange={p => toggle(h.id, p.target.checked)} /> {h.name}</label>)}</div> : <p className="muted small">Ingen aktive.</p>}
    </Fragment>;
  const allChecked = companies.length > 0 && checked.size === companies.length;
  return <div><p className="muted">Vælg hvilke selskaber og projekter medarbejderen kan vælge under Timefordeling i Min tid. Alt markeret = fri adgang.</p><select value={empId} onChange={h => setEmpId(h.target.value)}><option value="">— vælg medarbejder —</option>{employees.map(h => <option value={h.id} key={h.id}>{h.name}</option>)}</select>{empId && <Fragment>{allChecked && <p className="muted small">✓ Fri adgang til alle selskaber og projekter.</p>}{section("🏢 Selskaber", selskaber)}{section("📁 Projekter", projekter)}<button className="primary" onClick={async () => {
        try {
          await api.saveAccess(Number(empId), [...checked], checked.size === companies.length);
          flash("✓ Adgang gemt");
          onChanged();
        } catch (h) {
          flash("❌ " + (h as Error).message);
        }
      }}>💾 Gem adgang</button></Fragment>}</div>;
}
