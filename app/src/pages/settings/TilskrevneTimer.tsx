import { useState } from "react";
import { api, type HourCredit, type Period } from "../../lib/api";
import { fmtDate, fmtNum, parseNum } from "../../lib/format";

/**
 * Timer tilskrevet en medarbejder pr. lønperiode (hour_credits), fx afspadsering på baggrund af
 * vagttelefon. Indtastes manuelt ved periodens afslutning og lægges til ÅTD saldo.
 */
export function TilskrevneTimer({
  empId,
  empName,
  periods,
  credits,
  flash,
  onChanged,
  onClose
}: {
  empId: number;
  empName: string;
  periods: Period[];
  credits: HourCredit[];
  flash: (msg: string) => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const current = periods.find(p => p.start_date <= today && today <= p.end_date) || periods[periods.length - 1];
  const [periodId, setPeriodId] = useState<number | "">(current?.id ?? "");
  const existing = credits.find(c => c.period_id === periodId);
  const [hours, setHours] = useState(existing ? fmtNum(existing.hours) : "");
  const [note, setNote] = useState(existing?.note || "");
  const [saving, setSaving] = useState(false);
  const pick = (id: number | "") => {
    setPeriodId(id);
    const c = credits.find(x => x.period_id === id);
    setHours(c ? fmtNum(c.hours) : "");
    setNote(c?.note || "");
  };
  const save = async (id: number, h: number, n: string) => {
    setSaving(true);
    try {
      await api.saveHourCredit(empId, id, h, n);
      flash(h ? `✓ ${fmtNum(h)} t tilskrevet ${empName}` : "✓ Tilskrivning fjernet");
      onChanged();
    } catch (e) {
      flash("❌ " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const periodById = (id: number) => periods.find(p => p.id === id);
  const list = credits
    .map(c => ({ c, p: periodById(c.period_id) }))
    .sort((a, b) => (b.p?.start_date || "").localeCompare(a.p?.start_date || ""));
  const parsed = hours.trim() === "" ? 0 : parseNum(hours);
  return <section className="dayform"><h3>Timer tilskrives: {empName} <button className="ghost" onClick={onClose}>✕</button></h3><p className="muted small">Timer der lægges til ÅTD saldo for en lønperiode, fx afspadsering på baggrund af vagttelefon. Der sker ingen automatisk omregning; skriv det antal timer, aftalen giver. Tom eller 0 fjerner tilskrivningen.</p><div className="row"><label>Lønperiode <select value={periodId} onChange={e => pick(e.target.value ? Number(e.target.value) : "")}>{periods.map(p => <option key={p.id} value={p.id}>{p.month_name} {p.year} ({fmtDate(p.start_date)} – {fmtDate(p.end_date)})</option>)}</select></label><label>Timer <input className="hours" inputMode="decimal" placeholder="0" value={hours} onChange={e => setHours(e.target.value)} /></label><label>Note <input placeholder="fx vagttelefon" value={note} onChange={e => setNote(e.target.value)} /></label><button className="primary" disabled={saving || periodId === "" || parsed == null} onClick={() => save(Number(periodId), parsed ?? 0, note)}>💾 Gem</button></div>{list.length ? <div className="tablewrap"><table className="datatable"><thead><tr><th>Lønperiode</th><th className="num">Timer</th><th>Note</th><th>Indtastet</th><th></th></tr></thead><tbody>{list.map(({ c, p }) => <tr key={c.period_id}><td>{p ? `${p.month_name} ${p.year}` : c.period_id}</td><td className="num">{fmtNum(c.hours)}</td><td>{c.note || ""}</td><td className="muted small">{fmtDate(c.created_at.slice(0, 10))}</td><td><button className="ghost" title="Fjern tilskrivningen" disabled={saving} onClick={() => save(c.period_id, 0, "")}>✕</button></td></tr>)}</tbody></table></div> : <p className="muted small">Ingen tilskrevne timer endnu.</p>}</section>;
}
