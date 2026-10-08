import { useState } from "react";
import type { RuleInput } from "../../lib/api";
import { fmtNum, parseNum } from "../../lib/format";

type Target = { id: number; name: string };

type Draft = {
  target_company_id: number | undefined;
  /** Andel i procent som tekst, fx "50" eller "33,33". */
  pct: string;
};

/**
 * Pop-up hvor et projekts fordelingsnøgler sættes (hvilke selskaber der betaler og hvor stor en andel).
 * Et løbende projekt skal have mindst én nøgle; andelene må højst summe til 100 %, resten bliver på projektet.
 */
export function FordelingsDialog({ projectName, loebende, initial, targets, intro, saveLabel, onSave, onCancel }: {
  projectName: string;
  loebende: boolean;
  initial: RuleInput[];
  targets: Target[];
  intro?: string;
  saveLabel: string;
  onSave: (rules: RuleInput[]) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    initial.length
      ? initial.map(r => ({ target_company_id: r.target_company_id, pct: fmtNum(r.share * 100) }))
      : [{ target_company_id: targets[0]?.id, pct: "100" }]
  );
  const rules = drafts
    .filter(d => d.target_company_id != null && (parseNum(d.pct) || 0) > 0)
    .map(d => ({ target_company_id: d.target_company_id as number, share: (parseNum(d.pct) || 0) / 100 }));
  const sum = drafts.reduce((s, d) => s + (parseNum(d.pct) || 0), 0);
  const problem = sum > 100.01 ? "Andelene må højst summe til 100 %"
    : loebende && rules.length === 0 ? "Et løbende projekt skal have mindst én fordelingsnøgle"
    : "";
  const set = (i: number, changes: Partial<Draft>) => setDrafts(drafts.map((d, j) => j === i ? { ...d, ...changes } : d));
  return <div className="modal-backdrop" onClick={onCancel} onKeyDown={e => e.key === "Escape" && onCancel()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="fordeling-titel" onClick={e => e.stopPropagation()}><h3 id="fordeling-titel">Fordelingsnøgler · {projectName || "nyt projekt"}</h3><p className="muted small">{intro || "Vælg hvilke selskaber projektets timer faktureres til, og med hvor stor en andel."}</p><table className="datatable admin slim"><thead><tr><th>Faktureres til</th><th className="num">Andel %</th><th /></tr></thead><tbody>{drafts.map((d, i) => <tr key={i}><td><select value={d.target_company_id ?? ""} onChange={e => set(i, { target_company_id: Number(e.target.value) })}>{targets.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></td><td><input className="hours" inputMode="decimal" value={d.pct} onChange={e => set(i, { pct: e.target.value })} /></td><td><button className="ghost x" title="Fjern" onClick={() => setDrafts(drafts.filter((_d, j) => j !== i))}>✕</button></td></tr>)}</tbody></table><div className="row"><button className="ghost" onClick={() => setDrafts([...drafts, { target_company_id: targets[0]?.id, pct: "" }])}>➕ Tilføj selskab</button><span className={problem ? "warn" : "ok"}>Sum: {fmtNum(sum)} %{!problem && sum > 0 && sum < 99.99 && " · resten faktureres til projektet selv"}</span></div>{problem && <p className="warn small">{problem}</p>}<div className="modal-actions"><button className="ghost" onClick={onCancel}>Annullér</button><button className="primary" autoFocus disabled={!!problem} onClick={() => onSave(rules)}>{saveLabel}</button></div></div></div>;
}
