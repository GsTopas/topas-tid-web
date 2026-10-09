import { useEffect, useState } from "react";
import { api, type NormDay, type WeeklyNorm } from "../../lib/api";
import { fmtDate, fmtNum } from "../../lib/format";
import { activeSplit, weekSum, type NormSplit } from "../../lib/norm";
import { SaveAllBar, useDirtyRows } from "../settings/shared";
import { LUNCH_OPTIONS, WEEKDAYS_LONG } from "./constants";
import { dayDefaults } from "./normweek";
import { workHours } from "./time";
import { TimePicker } from "./TimePicker";

/** Ugedagens type i normugen: ikke sat (som kontrakten), arbejdsdag med tider, eller fridag (0 t). */
type Kind = "" | "arbejde" | "fri";
type Row = { weekday: number; kind: Kind; time_in: string; time_out: string; lunch_min: number };

const toRows = (days: NormDay[], norm: WeeklyNorm | null | undefined): Row[] =>
  WEEKDAYS_LONG.map((_d, weekday) => {
    const saved = days.find(n => n.weekday === weekday);
    const defaults = dayDefaults(saved, Number(norm?.[weekday] || 0));
    return { weekday, kind: saved ? saved.day_off ? "fri" : "arbejde" : "", ...defaults };
  });

/** Ugedagens timer i normugen: arbejdsdag = mødt → gået − frokost, fridag = 0, ikke sat = kontraktens. */
const rowHours = (r: Row, norm: WeeklyNorm | null | undefined): number =>
  r.kind === "arbejde" ? workHours(r.time_in, r.time_out, r.lunch_min) : r.kind === "fri" ? 0 : Number(norm?.[r.weekday] || 0);

type Props = {
  empId: number;
  /** Navn når man sætter normuge for en anden (leder/admin). */
  empName: string | null;
  /** Kontraktens normtimer pr. ugedag (employees.weekly_norm). */
  weeklyNorm: WeeklyNorm | null | undefined;
  days: NormDay[] | null;
  /** Gemte dagsfordelinger fra normugen (norm_split). */
  splits: NormSplit[] | null;
  onSaved: (days: NormDay[]) => void;
  flash: (msg: string) => void;
};

/**
 * "Konfigurer normuge" under Min tid: typisk mødt/gået/frokost (eller fridag) pr. ugedag.
 * Forudfylder tomme dage, og giver normugen samme ugesum som kontrakten, bliver den også dagsnormen.
 */
export function NormUge({ empId, empName, weeklyNorm, days, splits, onSaved, flash }: Props) {
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
    const bad = rows.find(r => r.kind === "arbejde" && r.time_out <= r.time_in);
    if (bad) {
      return flash(`❌ ${WEEKDAYS_LONG[bad.weekday]}: "Gået" skal være efter "Mødt" (vælg "Fridag", hvis du ikke arbejder den dag)`);
    }
    const payload: NormDay[] = rows.filter(r => r.kind).map(({ weekday, kind, time_in, time_out, lunch_min }) =>
      kind === "fri" ? { weekday, time_in: "", time_out: "", lunch_min, day_off: true } : { weekday, time_in, time_out, lunch_min });
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

  const contractSum = weekSum(weeklyNorm);
  const normSum = rows.reduce((sum, r) => sum + rowHours(r, weeklyNorm), 0);
  const matches = Math.abs(normSum - contractSum) < 0.01;
  const changed = edits.dirty.size > 0;
  // Den seneste gemte dagsfordeling, og om den gælder nu (samme ugesum som kontrakten).
  const latest = (splits || []).reduce<NormSplit | null>((best, s) => !best || s.valid_from > best.valid_from ? s : best, null);
  const active = latest ? activeSplit(weeklyNorm, [latest], latest.valid_from) : null;
  const contractDays = WEEKDAYS_LONG.slice(0, 5).map((_d, i) => fmtNum(Number(weeklyNorm?.[i] || 0))).join(" / ");

  return <section className="dayform"><h2>⚙️ Normuge{empName ? ` for ${empName}` : ""}</h2><p className="muted small">Sæt de tider, du typisk møder, går og holder frokost hver ugedag, og marker dage du ikke arbejder som "Fridag". Tiderne forudfylder dage, der ikke er registreret endnu (dage du allerede har gemt, ændres ikke, og en forudfyldt dag skal stadig gemmes). Ugedage der ikke er sat, forudfyldes som før (08:00 og kontraktens normtid).</p><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Ugedag</th><th>Type</th><th>Mødt</th><th>Gået</th><th>Frokost</th><th>Timer</th><th>Kontrakt</th></tr></thead><tbody>{rows.map(r => {
          const work = r.kind === "arbejde";
          return <tr key={r.weekday} className={r.kind ? "" : "muted"}><td>{WEEKDAYS_LONG[r.weekday]}</td><td><select value={r.kind} onChange={e => update(r.weekday, { kind: e.target.value as Kind })}><option value="">Ikke sat</option><option value="arbejde">Arbejdsdag</option><option value="fri">Fridag</option></select></td>{work ? <><td><TimePicker value={r.time_in} onChange={v => update(r.weekday, { time_in: v })} /></td><td><TimePicker value={r.time_out} onChange={v => update(r.weekday, { time_out: v })} /></td><td><select value={r.lunch_min} onChange={e => update(r.weekday, { lunch_min: Number(e.target.value) })}>{[...new Set([...LUNCH_OPTIONS, r.lunch_min])].sort((a, b) => a - b).map(m => <option value={m} key={m}>{m} min</option>)}</select></td></> : <td colSpan={3} className="muted small">{r.kind === "fri" ? "Fri — 0 timer" : "Som kontrakten"}</td>}<td>{fmtNum(rowHours(r, weeklyNorm))} t</td><td>{fmtNum(Number(weeklyNorm?.[r.weekday] || 0))} t</td></tr>;
        })}</tbody></table></div>{!rows.some(r => r.kind) ? null : matches ? <p className="small ok">✓ Normugen giver {fmtNum(normSum)} t om ugen ligesom kontrakten, så dagsnormen (saldo, manglende dage og Min periode) følger normugen{!changed && active ? ` fra ${fmtDate(active.valid_from)}` : ", når du gemmer"}. Godkendte perioder beholder deres tal.</p> : <p className="small warn">⚠️ Normugen giver {fmtNum(normSum)} t om ugen, men kontrakten siger {fmtNum(contractSum)} t. Dagsnormen fordeles derfor stadig som i kontrakten ({contractDays} t man–fre), og normugen bruges kun til at forudfylde dagene. Kontrakten rettes af admin under Medarbejdere.</p>}<SaveAllBar count={edits.dirty.size} saving={saving} onSave={save} onUndo={undo} /></section>;
}
