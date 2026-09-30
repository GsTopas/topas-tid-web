import { Fragment, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmtNum, parseNum } from "../../lib/format";

type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];
type Rule = Awaited<ReturnType<typeof api.rulesAll>>[number];

type RuleDraft = {
  target_company_id: Company["id"] | undefined;
  /** Andel i procent som tekst, fx "50" eller "33,33". */
  pct: string;
};

export function Fordelingsregler({ flash }: { flash: (msg: string) => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [drafts, setDrafts] = useState<RuleDraft[]>([]);
  const load = () => Promise.all([api.companiesAll(), api.rulesAll()]).then(([w, b]) => {
    setCompanies(w);
    setRules(b);
  });
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!sourceId || !rules) {
      setDrafts([]);
      return;
    }
    setDrafts(rules.filter(w => w.source_company_id === Number(sourceId)).map(w => ({
      target_company_id: w.target_company_id,
      pct: fmtNum(Number(w.share) * 100)
    })));
  }, [sourceId, rules]);
  if (!rules) {
    return <p className="muted">Henter…</p>;
  }
  const withRules = new Set(rules.map(w => w.source_company_id));
  const projects = companies.filter(w => w.kind === "projekt");
  const targets = companies.filter(w => w.kind === "selskab");
  const sum = drafts.reduce((w, b) => w + (parseNum(b.pct) || 0), 0);
  return <div><p className="muted">Regler flytter et projekts timer til de selskaber, der skal faktureres. Andele i procent — skal summe til 100.</p><select value={sourceId} onChange={w => setSourceId(w.target.value)}><option value="">— vælg projekt —</option>{projects.map(w => <option value={w.id} key={w.id}>{w.name}{withRules.has(w.id) ? " ●" : ""}</option>)}</select>{sourceId && <Fragment><table className="datatable admin slim"><thead><tr><th>Faktureres til</th><th className="num">Andel %</th><th /></tr></thead><tbody>{drafts.map((w, b) => <tr key={b}><td><select value={w.target_company_id} onChange={A => setDrafts(drafts.map((_, S) => S === b ? {
                ..._,
                target_company_id: Number(A.target.value)
              } : _))}>{targets.map(A => <option value={A.id} key={A.id}>{A.name}</option>)}</select></td><td><input className="hours" value={w.pct} onChange={A => setDrafts(drafts.map((_, S) => S === b ? {
                ..._,
                pct: A.target.value
              } : _))} /></td><td><button className="ghost x" onClick={() => setDrafts(drafts.filter((_A, _) => _ !== b))}>✕</button></td></tr>)}</tbody></table><div className="row"><button className="ghost" onClick={() => setDrafts([...drafts, {
          target_company_id: targets[0]?.id,
          pct: ""
        }])}>➕ Tilføj modtager</button><span className={Math.abs(sum - 100) < 0.01 || drafts.length === 0 ? "ok" : "warn"}>Sum: {fmtNum(sum)} %{sum > 100.01 && " — over 100 % kan ikke gemmes"}{sum > 0 && sum < 99.99 && " — resten faktureres til projektet selv"}</span><button className="primary" disabled={sum > 100.01} title={sum > 100.01 ? "Andelene må højst summe til 100 %" : ""} onClick={async () => {
          try {
            await api.saveRulesForSource(Number(sourceId), drafts.filter(w => (parseNum(w.pct) || 0) > 0).map(w => ({
              // NOTE(recovery): target_company_id kan være undefined, hvis der ikke findes selskaber (som i originalen).
              target_company_id: w.target_company_id as Company["id"],
              share: (parseNum(w.pct) || 0) / 100
            })));
            flash("Regler gemt ✓");
            load();
          } catch (w) {
            flash("❌ " + (w as Error).message);
          }
        }}>💾 Gem regler</button></div></Fragment>}</div>;
}
