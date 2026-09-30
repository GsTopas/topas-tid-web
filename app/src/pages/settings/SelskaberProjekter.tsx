import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];

/** Selskab/projekt under redigering (sort kan være tekst fra et input). */
type CompanyRow = Omit<Company, "name" | "kind" | "active" | "billing_type" | "expected_settlement"> & {
  name: string;
  kind: string;
  active: boolean;
  billing_type: string | null;
  expected_settlement: string | null;
};

export function SelskaberProjekter({ flash, onChanged }: { flash: (msg: string) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [newName, setNewName] = useState("");
  const [kindFilter, setKindFilter] = useState("alle");
  const load = () => api.companiesAll().then(list => setRows(list as CompanyRow[]));
  useEffect(() => {
    load();
  }, []);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const patch = (id: CompanyRow["id"], changes: Partial<CompanyRow>) =>
    setRows(rows.map(w => w.id === id ? { ...w, ...changes } : w));
  const shown = rows.filter(g => kindFilter === "alle" || g.kind === kindFilter);
  const save = async (g: CompanyRow) => {
    try {
      await api.saveCompany(g.id, {
        name: g.name,
        kind: g.kind,
        active: g.active,
        sort: Number(g.sort) || 0,
        billing_type: g.billing_type || "loebende",
        expected_settlement: g.billing_type === "samlet" && g.expected_settlement || null
      });
      flash(`${g.name} gemt ✓`);
      load();
      onChanged();
    } catch (d) {
      flash("❌ " + (d as Error).message);
    }
  };
  return <div><select value={kindFilter} onChange={g => setKindFilter(g.target.value)}><option value="alle">Alle typer</option><option value="selskab">Kun selskaber (drift)</option><option value="projekt">Kun projekter</option></select><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Navn</th><th>Type</th><th>Afregning</th><th>Aktiv</th><th /></tr></thead><tbody>{shown.map(g => <tr className={g.active ? "" : "inaktiv"} key={g.id}><td><input value={g.name} onChange={d => patch(g.id, {
                name: d.target.value
              })} /></td><td><select value={g.kind} onChange={d => patch(g.id, {
                kind: d.target.value
              })}><option value="selskab">Selskab (drift)</option><option value="projekt">Projekt</option></select></td><td>{g.kind === "projekt" ? <div className="afregning"><select value={g.billing_type || "loebende"} title="Løbende = med på månedsfakturaen. Samlet = akkumuleres til projektet afsluttes." onChange={d => patch(g.id, {
                  billing_type: d.target.value
                })}><option value="loebende">Løbende (pr. måned)</option><option value="samlet">Samles til afslutning</option></select>{g.billing_type === "samlet" && <input type="date" title="Forventet afregningsdato" value={g.expected_settlement || ""} onChange={d => patch(g.id, {
                  expected_settlement: d.target.value
                })} />}</div> : <span className="muted">Løbende</span>}</td><td><input type="checkbox" checked={g.active} onChange={d => patch(g.id, {
                active: d.target.checked
              })} /></td><td><button className="ghost" onClick={() => save(g)}>💾</button></td></tr>)}</tbody></table></div><div className="nyrow"><input placeholder="Nyt selskab/projekt…" value={newName} onChange={g => setNewName(g.target.value)} /><button className="primary" disabled={!newName.trim()} onClick={async () => {
        try {
          await api.saveCompany(null, {
            name: newName.trim(),
            kind: "projekt",
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
      }}>➕ Opret</button></div></div>;
}
