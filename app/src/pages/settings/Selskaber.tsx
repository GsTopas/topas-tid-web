import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { SaveAllBar, keepDirty, saveDirtyRows, useDirtyRows } from "./shared";

type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];

/** Selskaber (kind = selskab): faktureres for deres egne timer hver måned. Projekter har deres egen fane. */
export function Selskaber({ flash, onChanged }: { flash: (msg: string) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Company[] | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const edits = useDirtyRows<Company["id"]>();
  const fetchRows = () => api.companiesAll().then(list => list.filter(c => c.kind === "selskab"));
  const load = () => fetchRows().then(list => setRows(prev => keepDirty(list, prev, edits.current())));
  useEffect(() => {
    load();
  }, []);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const patch = (id: Company["id"], changes: Partial<Company>) => {
    setRows(rows.map(w => w.id === id ? { ...w, ...changes } : w));
    edits.mark(id);
  };
  const saveOne = (g: Company) =>
    api.saveCompany(g.id, {
        name: g.name,
        kind: "selskab",
        active: g.active,
        sort: Number(g.sort) || 0,
        billing_type: "loebende",
        expected_settlement: null
      });
  const saveAll = async () => {
    setSaving(true);
    const failed = await saveDirtyRows(rows, edits.dirty, saveOne, flash);
    edits.reset(failed);
    setSaving(false);
    load();
    onChanged();
  };
  const undo = () => {
    edits.reset();
    fetchRows().then(setRows);
  };
  return <div><p className="muted">Selskaber faktureres hver måned for de timer, der registreres direkte på dem, og for deres andel af projekterne.</p><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Navn</th><th>Aktiv</th></tr></thead><tbody>{rows.map(g => <tr className={g.active ? "" : "inaktiv"} key={g.id}><td><input value={g.name} onChange={d => patch(g.id, {
                name: d.target.value
              })} /></td><td><input type="checkbox" checked={g.active} onChange={d => patch(g.id, {
                active: d.target.checked
              })} /></td></tr>)}</tbody></table></div><SaveAllBar count={edits.dirty.size} saving={saving} onSave={saveAll} onUndo={undo} /><div className="nyrow"><input placeholder="Nyt selskab…" value={newName} onChange={g => setNewName(g.target.value)} /><button className="primary" disabled={!newName.trim()} onClick={async () => {
        try {
          await api.saveCompany(null, {
            name: newName.trim(),
            kind: "selskab",
            billing_type: "loebende",
            active: true,
            sort: 99
          });
          setNewName("");
          flash("Oprettet ✓");
          load();
          onChanged();
        } catch (g) {
          flash("❌ " + (g as Error).message);
        }
      }}>➕ Opret selskab</button></div></div>;
}
