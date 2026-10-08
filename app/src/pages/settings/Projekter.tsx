import { useEffect, useState } from "react";
import { api, type RuleInput } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { FordelingsDialog } from "./FordelingsDialog";
import { SaveAllBar, keepDirty, saveDirtyRows, useDirtyRows } from "./shared";

type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];
type BillingType = "loebende" | "samlet";

/** Projekt under redigering. `rules` = nye fordelingsnøgler, der ikke er gemt endnu (null = uændret). */
type ProjectRow = Omit<Company, "billing_type"> & {
  billing_type: BillingType;
  rules: RuleInput[] | null;
};

/** Pop-up'en: hvilket projekt, og hvad der sker, når nøglerne er sat. */
type DialogState =
  | { mode: "row"; id: number; revertTo?: BillingType }
  | { mode: "save"; id: number }
  | { mode: "new"; name: string };

export const PROJECT_TYPES: { value: BillingType; label: string }[] = [
  { value: "loebende", label: "Projekt (Løbende pr. måned)" },
  { value: "samlet", label: "Projekt (Samlet til afslutning)" }
];

const toRow = (c: Company): ProjectRow => ({ ...c, billing_type: c.billing_type === "samlet" ? "samlet" : "loebende", rules: null });

/**
 * Projekter (kind = projekt) i to typer: løbende pr. måned (faktureres hver måned efter fordelingsnøglerne,
 * som er obligatoriske) eller samlet til afslutning (parkeres til forventet afregningsdato).
 * Kun admin ser og sætter fordelingsnøgler; ledere kan rette projekter og oprette samlede projekter.
 */
export function Projekter({ flash, onChanged, isAdmin }: { flash: (msg: string) => void; onChanged: () => void; isAdmin: boolean }) {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [saved, setSaved] = useState<Map<number, BillingType>>(new Map());
  const [selskaber, setSelskaber] = useState<{ id: number; name: string }[]>([]);
  const [dbRules, setDbRules] = useState<Map<number, RuleInput[]>>(new Map());
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<BillingType>(isAdmin ? "loebende" : "samlet");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const edits = useDirtyRows<ProjectRow["id"]>();
  const fetchAll = async () => {
    const [companies, rules] = await Promise.all([api.companiesAll(), isAdmin ? api.rulesAll() : Promise.resolve([])]);
    const byProject = new Map<number, RuleInput[]>();
    for (const r of rules) {
      if (!r.active) continue;
      byProject.set(r.source_company_id, [...byProject.get(r.source_company_id) || [], { target_company_id: r.target_company_id, share: Number(r.share) }]);
    }
    setDbRules(byProject);
    setSelskaber(companies.filter(c => c.kind === "selskab").map(c => ({ id: c.id, name: c.active ? c.name : c.name + " (inaktiv)" })));
    const projects = companies.filter(c => c.kind === "projekt").map(toRow);
    setSaved(new Map(projects.map(p => [p.id, p.billing_type])));
    return projects;
  };
  const load = () => fetchAll().then(list => setRows(prev => keepDirty(list, prev, edits.current())));
  useEffect(() => {
    load();
  }, []);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const nameOf = new Map(selskaber.map(s => [s.id, s.name]));
  const rulesOf = (r: ProjectRow) => r.rules ?? dbRules.get(r.id) ?? [];
  const hasRules = (r: ProjectRow) => rulesOf(r).some(x => x.share > 0);
  /** Løbende uden nøgler kan ikke gemmes. Ledere kan ikke se nøglerne, så dér afgør databasen. */
  const missingRules = (r: ProjectRow) => isAdmin && r.billing_type === "loebende" && !hasRules(r);
  const patch = (id: ProjectRow["id"], changes: Partial<ProjectRow>) => {
    setRows(rs => rs && rs.map(w => w.id === id ? { ...w, ...changes } : w));
    edits.mark(id);
  };
  const saveOne = (g: ProjectRow) =>
    api.saveProject(g.id, {
      name: g.name,
      billing_type: g.billing_type,
      expected_settlement: g.expected_settlement,
      active: g.active,
      sort: Number(g.sort) || 0
    }, isAdmin ? g.rules : null).then(() => undefined);
  const saveAll = async (list: ProjectRow[] = rows) => {
    const blocked = list.find(r => edits.dirty.has(r.id) && missingRules(r));
    if (blocked) {
      setDialog({ mode: "save", id: blocked.id });
      return;
    }
    setSaving(true);
    const failed = await saveDirtyRows(list, edits.dirty, saveOne, flash);
    edits.reset(failed);
    setSaving(false);
    load();
    onChanged();
  };
  const undo = () => {
    edits.reset();
    fetchAll().then(setRows);
  };
  const changeType = (r: ProjectRow, type: BillingType) => {
    patch(r.id, { billing_type: type });
    if (type === "loebende" && missingRules({ ...r, billing_type: type })) {
      setDialog({ mode: "row", id: r.id, revertTo: r.billing_type });
    }
  };
  const create = async (rules: RuleInput[] | null) => {
    try {
      await api.saveProject(null, { name: newName.trim(), billing_type: newType, expected_settlement: null, active: true, sort: 99 }, rules);
      setNewName("");
      flash("✓ Projekt oprettet");
      load();
      onChanged();
    } catch (e) {
      flash("❌ " + (e as Error).message);
    }
  };
  const dialogRow = dialog && dialog.mode !== "new" ? rows.find(r => r.id === dialog.id) : undefined;
  const closeDialog = () => {
    if (dialog?.mode === "row" && dialog.revertTo && dialogRow) {
      patch(dialogRow.id, { billing_type: dialog.revertTo });
    }
    setDialog(null);
  };
  const onDialogSave = (rules: RuleInput[]) => {
    const d = dialog;
    setDialog(null);
    if (!d) return;
    if (d.mode === "new") {
      create(rules);
      return;
    }
    patch(d.id, { rules });
    if (d.mode === "save") {
      saveAll(rows.map(r => r.id === d.id ? { ...r, rules } : r));
    }
  };
  const rulesText = (r: ProjectRow) => rulesOf(r).map(x => `${nameOf.get(x.target_company_id) ?? "?"} ${fmtNum(x.share * 100)} %`).join(" · ");
  return <div><p className="muted">Løbende projekter faktureres hver måned efter deres fordelingsnøgler, som skal være sat. Samlede projekter holdes ude af månedsfakturaen og afregnes ved afslutning.</p><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Navn</th><th>Type</th><th>Afregning</th>{isAdmin && <th>Fordelingsnøgler</th>}<th>Aktiv</th></tr></thead><tbody>{rows.map(g => <tr className={g.active ? "" : "inaktiv"} key={g.id}><td><input value={g.name} onChange={d => patch(g.id, {
                name: d.target.value
              })} /></td><td><select value={g.billing_type} onChange={d => changeType(g, d.target.value as BillingType)}>{PROJECT_TYPES.map(t => <option key={t.value} value={t.value} disabled={t.value === "loebende" && !isAdmin && saved.get(g.id) !== "loebende"}>{t.label}</option>)}</select></td><td>{g.billing_type === "samlet" ? <div className="afregning"><input type="date" title="Forventet afregningsdato" value={g.expected_settlement || ""} onChange={d => patch(g.id, {
                  expected_settlement: d.target.value
                })} /></div> : <span className="muted" title="Løbende projekter faktureres hver måned; afregningen kan ikke ændres">🔒 Løbende (pr. måned)</span>}</td>{isAdmin && <td>{hasRules(g) ? <span className="small">{rulesText(g)}</span> : <span className={g.billing_type === "loebende" ? "warn small" : "muted small"}>{g.billing_type === "loebende" ? "Mangler" : "Ingen (direkte til projektet)"}</span>} <button className="ghost" title="Ret fordelingsnøgler" onClick={() => setDialog({ mode: "row", id: g.id })}>✏️</button></td>}<td><input type="checkbox" checked={g.active} onChange={d => patch(g.id, {
                active: d.target.checked
              })} /></td></tr>)}</tbody></table></div><SaveAllBar count={edits.dirty.size} saving={saving} onSave={() => saveAll()} onUndo={undo} /><div className="nyrow"><input placeholder="Nyt projekt…" value={newName} onChange={g => setNewName(g.target.value)} /><select value={newType} onChange={e => setNewType(e.target.value as BillingType)}>{PROJECT_TYPES.map(t => <option key={t.value} value={t.value} disabled={t.value === "loebende" && !isAdmin}>{t.label}</option>)}</select><button className="primary" disabled={!newName.trim()} onClick={() => newType === "loebende" ? setDialog({ mode: "new", name: newName.trim() }) : create(null)}>➕ Opret projekt</button></div>{!isAdmin && <p className="muted small">Løbende projekter kræver fordelingsnøgler og oprettes derfor af admin.</p>}{dialog && (dialog.mode === "new" || dialogRow) && <FordelingsDialog
      projectName={dialog.mode === "new" ? dialog.name : dialogRow!.name}
      loebende={dialog.mode === "new" ? newType === "loebende" : dialogRow!.billing_type === "loebende"}
      initial={dialog.mode === "new" ? [] : rulesOf(dialogRow!)}
      targets={selskaber}
      intro={dialog.mode === "row" && !dialog.revertTo ? undefined : "Et projekt, der er løbende pr. måned, skal have fordelingsnøgler, før det kan gemmes. Vælg hvilke selskaber timerne faktureres til."}
      saveLabel={dialog.mode === "new" ? "➕ Opret projekt" : dialog.mode === "save" ? "💾 Gem" : "✓ Brug nøglerne"}
      onSave={onDialogSave}
      onCancel={closeDialog} />}</div>;
}
