import { useEffect, useState } from "react";
import { api, type NormDay, type WeeklyNorm } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { SaveAllBar, useDirtyRows } from "../settings/shared";
import { LUNCH_OPTIONS, WEEKDAYS_LONG } from "./constants";
import { dayDefaults } from "./normweek";
import { workHours } from "./time";
import { TimePicker } from "./TimePicker";

/** En ugedag i redigeringen: `on` = ugedagen har normtider (ellers forudfyldes den som før). */
type Row = NormDay & { on: boolean };

const toRows = (days: NormDay[], norm: WeeklyNorm | null | undefined): Row[] =>
  WEEKDAYS_LONG.map((_d, weekday) => {
    const saved = days.find(n => n.weekday === weekday);
    return saved ? { ...saved, on: true } : { weekday, ...dayDefaults(null, Number(norm?.[weekday] || 0)), on: false };
  });

type Props = {
  empId: number;
  /** Navn når man sætter normuge for en anden (leder/admin). */
  empName: string | null;
  /** Kontraktens normtimer pr. ugedag (employees.weekly_norm). */
  weeklyNorm: WeeklyNorm | null | undefined;
  days: NormDay[] | null;
  onSaved: (days: NormDay[]) => void;
  flash: (msg: string) => void;
};

/** "Konfigurer normuge" under Min tid: typisk mødt/gået/frokost pr. ugedag, som forudfylder tomme dage. */
export function NormUge({ empId, empName, weeklyNorm, days, onSaved, flash }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const edits = useDirtyRows<number>();

  useEffect(() => {
    if (days) {
      setRows(toRows(days, weeklyNorm));
      edits.reset();
    }
  }, [days, empId]);

  if (!rows) {
    return <p className="muted">Henter normuge…</p>;
  }

  const update = (weekday: number, p: Partial<Row>) => {
    setRows(prev => (prev as Row[]).map(r => r.weekday === weekday ? { ...r, ...p } : r));
    edits.mark(weekday);
  };

  const save = async () => {
    const active = rows.filter(r => r.on);
    const bad = active.find(r => r.time_out <= r.time_in);
    if (bad) {
      return flash(`❌ ${WEEKDAYS_LONG[bad.weekday]}: "Gået" skal være efter "Mødt"`);
    }
    const payload: NormDay[] = active.map(({ weekday, time_in, time_out, lunch_min }) => ({ weekday, time_in, time_out, lunch_min }));
    setSaving(true);
    try {
      await api.saveNormWeek(empId, payload);
      edits.reset();
      onSaved(payload);
      flash(`✓ Normuge gemt${empName ? ` for ${empName}` : ""}`);
    } catch (err) {
      flash("❌ " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const undo = () => {
    setRows(toRows(days || [], weeklyNorm));
    edits.reset();
  };

  return <section className="dayform"><h2>⚙️ Normuge{empName ? ` for ${empName}` : ""}</h2><p className="muted small">Sæt de tider du typisk møder, går og holder frokost hver ugedag. De bruges til at forudfylde dage, der ikke er registreret endnu. Dage du allerede har gemt, ændres ikke, og en forudfyldt dag skal stadig gemmes. Ugedage uden flueben forudfyldes som før (08:00 og din normtid).</p><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Ugedag</th><th>Bruges</th><th>Mødt</th><th>Gået</th><th>Frokost</th><th>Arbejdstimer</th><th>Normtid (kontrakt)</th></tr></thead><tbody>{rows.map(r => {
          const hours = workHours(r.time_in, r.time_out, r.lunch_min);
          const norm = Number(weeklyNorm?.[r.weekday] || 0);
          const diff = Math.round((hours - norm) * 100) / 100;
          return <tr key={r.weekday} className={r.on ? "" : "muted"}><td>{WEEKDAYS_LONG[r.weekday]}</td><td><input type="checkbox" checked={r.on} onChange={e => update(r.weekday, { on: e.target.checked })} /></td><td><TimePicker value={r.time_in} onChange={v => update(r.weekday, { time_in: v, on: true })} /></td><td><TimePicker value={r.time_out} onChange={v => update(r.weekday, { time_out: v, on: true })} /></td><td><select value={r.lunch_min} onChange={e => update(r.weekday, { lunch_min: Number(e.target.value), on: true })}>{[...new Set([...LUNCH_OPTIONS, r.lunch_min])].sort((a, b) => a - b).map(m => <option value={m} key={m}>{m} min</option>)}</select></td><td>{r.on ? `${fmtNum(hours)} t` : "—"}</td><td>{fmtNum(norm)} t{r.on && Math.abs(diff) > 0.01 && <span className="warn small"> ⚠️ {diff > 0 ? "+" : ""}{fmtNum(diff)} t</span>}</td></tr>;
        })}</tbody></table></div><p className="muted small">Normtiden fra kontrakten (sat af admin under Medarbejdere) er stadig den, der bruges til saldo og manglende dage. ⚠️ viser, når normugens arbejdstimer afviger fra den.</p><SaveAllBar count={edits.dirty.size} saving={saving} onSave={save} onUndo={undo} /></section>;
}
