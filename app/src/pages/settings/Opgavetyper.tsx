import { useEffect, useState } from "react";
import { api, type SessionEmployee } from "../../lib/api";
import { DEPARTMENTS } from "./shared";

type TaskType = Awaited<ReturnType<typeof api.taskTypesFor>>[number];

type TaskTypeRow = Omit<TaskType, "name" | "sort" | "active"> & {
  name: string;
  sort: number | string;
  active: boolean;
};

export function Opgavetyper({
  flash,
  onChanged,
  emp
}: {
  flash: (msg: string) => void;
  onChanged: () => void;
  emp: SessionEmployee | null;
}) {
  // Ikke-admins (ledere) ser kun deres egen afdeling
  const ownDeptOnly = emp && !emp.is_admin;
  // NOTE(recovery): department kan være null for en leder uden afdeling; sendes uændret videre som i originalen.
  const [dept, setDept] = useState<string>(ownDeptOnly ? emp.department as string : "Marketing");
  const [rows, setRows] = useState<TaskTypeRow[] | null>(null);
  const [newName, setNewName] = useState("");
  const load = () => api.taskTypesFor(dept).then(list => setRows(list as TaskTypeRow[]));
  useEffect(() => {
    load();
  }, [dept]);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const patch = (id: TaskTypeRow["id"], changes: Partial<TaskTypeRow>) =>
    setRows(rows.map(w => w.id === id ? { ...w, ...changes } : w));
  return <div>{ownDeptOnly ? <p className="muted small">Opgavetyper for din afdeling: <b>{dept}</b></p> : <select value={dept} onChange={g => setDept(g.target.value)}>{DEPARTMENTS.map(g => <option key={g}>{g}</option>)}</select>}<table className="datatable admin slim"><thead><tr><th>Opgavetype</th><th className="num">Sortering</th><th>Aktiv</th><th /></tr></thead><tbody>{rows.map(g => <tr className={g.active ? "" : "inaktiv"} key={g.id}><td><input value={g.name} onChange={d => patch(g.id, {
              name: d.target.value
            })} /></td><td><input className="hours" value={g.sort} onChange={d => patch(g.id, {
              sort: d.target.value
            })} /></td><td><input type="checkbox" checked={g.active} onChange={d => patch(g.id, {
              active: d.target.checked
            })} /></td><td><button className="ghost" onClick={async () => {
              try {
                await api.saveTaskType(g.id, {
                  name: g.name,
                  sort: Number(g.sort) || 0,
                  active: g.active
                });
                flash("Gemt ✓");
                load();
                onChanged();
              } catch (d) {
                flash("❌ " + (d as Error).message);
              }
            }}>💾</button></td></tr>)}</tbody></table><div className="nyrow"><input placeholder="Ny opgavetype…" value={newName} onChange={g => setNewName(g.target.value)} /><button className="primary" disabled={!newName.trim()} onClick={async () => {
        try {
          await api.saveTaskType(null, {
            department: dept,
            name: newName.trim(),
            sort: 99,
            active: true
          });
          setNewName("");
          flash("Oprettet ✓");
          load();
          onChanged();
        } catch (g) {
          flash("❌ " + (g as Error).message);
        }
      }}>➕ Opret</button></div></div>;
}
