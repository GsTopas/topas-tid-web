import { Fragment, useEffect, useState } from "react";
import { api } from "../../lib/api";

type Employee = Awaited<ReturnType<typeof api.employeesAll>>[number];
type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];

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
  return <div><p className="muted">Vælg hvilke selskaber/projekter medarbejderen kan vælge under Min tid. Alle markeret = fri adgang.</p><select value={empId} onChange={h => setEmpId(h.target.value)}><option value="">— vælg medarbejder —</option>{employees.map(h => <option value={h.id} key={h.id}>{h.name}</option>)}</select>{empId && <Fragment><div className="checkgrid">{companies.map(h => <label key={h.id}><input type="checkbox" checked={checked.has(h.id)} onChange={p => {
            const g = new Set(checked);
            if (p.target.checked) {
              g.add(h.id);
            } else {
              g.delete(h.id);
            }
            setChecked(g);
          }} /> {h.name}</label>)}</div><button className="primary" onClick={async () => {
        try {
          await api.saveAccess(Number(empId), [...checked], checked.size === companies.length);
          flash("Adgang gemt ✓");
          onChanged();
        } catch (h) {
          flash("❌ " + (h as Error).message);
        }
      }}>💾 Gem adgang</button></Fragment>}</div>;
}
