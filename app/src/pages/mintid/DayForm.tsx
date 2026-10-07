import type { Dispatch, SetStateAction } from "react";
import type { Boot } from "../../lib/api";
import { fmtDate, fmtNum, parseNum, weekdayIdx } from "../../lib/format";
import { ABSENCE_TYPES, DAY_TYPES, LOCATION_NOTE_TYPES, LUNCH_OPTIONS, WEEKDAYS_LONG } from "./constants";
import { workHours } from "./time";
import { TimePicker } from "./TimePicker";
import type { AllocLine, DayFormState } from "./types";

/** Afledte tal for formularen (beregnes i MinTid, som i originalen). */
export type FormTotals = {
  /** Arbejdsdag (Kontor / Andet sted / Rejsedag). */
  isWorkDay: boolean;
  /** Heldags-fravær med fraværstimer. */
  isAbsenceDay: boolean;
  /** Dagens arbejdstimer. */
  total: number;
  /** Fordelte timer. */
  allocated: number;
  /** Tilbage at fordele. */
  remaining: number;
  /** Fremdrift i procent (max 100). */
  pct: number;
  over: boolean;
  done: boolean;
  /** Opgavetype er obligatorisk. */
  taskRequired: boolean;
};

type Props = {
  form: DayFormState;
  setForm: Dispatch<SetStateAction<DayFormState | null>>;
  date: string;
  boot: Boot;
  normHours: number;
  totals: FormTotals;
  patch: (p: Partial<DayFormState>) => void;
  updateAlloc: (idx: number, p: Partial<AllocLine>) => void;
  missingTask: (line: AllocLine) => boolean;
  /** Delvist fravær (timer) på en arbejdsdag. */
  partialAbsence: () => number;
  onSaveDefaults: () => void;
};

export function DayForm({ form, setForm, date, boot, normHours, totals, patch, updateAlloc, missingTask, partialAbsence, onSaveDefaults }: Props) {
  const { isWorkDay, isAbsenceDay, total, allocated, remaining, pct, over, done, taskRequired } = totals;
  return <section className="dayform"><h2>{WEEKDAYS_LONG[weekdayIdx(date)]} {fmtDate(date)}</h2>{normHours > 0 && <span className="muted">Normal arbejdstid: {fmtNum(normHours)} timer</span>}<div className="types">{DAY_TYPES.map(([type, icon]) => <button className={"type" + (form.day_type === type ? " sel" : "")} onClick={() => patch({
        day_type: type
      })} key={type}><span>{icon}</span> {type}</button>)}</div>{LOCATION_NOTE_TYPES.includes(form.day_type) && <input className="wide" placeholder={form.day_type === "Rejsedag" ? "Hvor? (fx Vietnam)" : "Hvor? (fx hjemmefra)"} value={form.location_note} onChange={e => patch({
      location_note: e.target.value
    })} />}{isAbsenceDay && <div className="row"><label>Fraværstimer<input className="hours" value={form.absence_hours} onChange={e => patch({
          absence_hours: e.target.value
        })} /></label>{form.day_type === "Andet – firmabetalt" && <label>Hvilken slags? (kode 50)<select value={form.absence_choice} onChange={e => patch({
          absence_choice: e.target.value
        })}><option value="">— vælg —</option>{(boot.andet_valg || []).map(o => <option key={o}>{o}</option>)}</select></label>}{form.day_type === "Andet – egen betalt" && <label>Hvilken slags? (kode 51 — fritekst)<input value={form.absence_note} placeholder="fx ikke optjent ferie, privat gøremål …" onChange={e => patch({
          absence_note: e.target.value
        })} /></label>}</div>}{isWorkDay && <div className="row"><label>Mødt<TimePicker value={form.time_in} onChange={v => patch({
          time_in: v,
          work_hours: fmtNum(workHours(v, form.time_out, form.lunch_min, partialAbsence()))
        })} /></label><label>Gået<TimePicker value={form.time_out} onChange={v => patch({
          time_out: v,
          work_hours: fmtNum(workHours(form.time_in, v, form.lunch_min, partialAbsence()))
        })} /></label><label>Frokost<select value={form.lunch_min} onChange={e => {
          const lunch = Number(e.target.value);
          patch({
            lunch_min: lunch,
            work_hours: fmtNum(workHours(form.time_in, form.time_out, lunch, partialAbsence()))
          });
        }}>{[...new Set([...LUNCH_OPTIONS, form.lunch_min])].sort((a, b) => a - b).map(m => <option value={m} key={m}>{m} min</option>)}</select></label><label>Arbejdstimer (mødt − gået − frokost − fravær)<input className="hours" value={form.work_hours} disabled={true} title="Beregnes automatisk af mødt, gået og frokost" /></label></div>}{isWorkDay && <div className="row extraabs"><label>🤒 Fravær samme dag? (læge, delvis sygdom …)<select value={form.extra_abs} onChange={e => {
          const abs = e.target.value;
          // Ny fraværstype starter med 1 time; skift mellem typer beholder timerne.
          const absHours = abs ? form.extra_abs ? parseNum(form.absence_hours) || 0 : 1 : 0;
          patch({
            extra_abs: abs,
            ...(form.extra_abs || !abs ? {} : {
              absence_hours: "1"
            }),
            work_hours: fmtNum(workHours(form.time_in, form.time_out, form.lunch_min, absHours))
          });
        }}><option value="">Intet fravær</option>{ABSENCE_TYPES.map(o => <option key={o}>{o}</option>)}</select></label>{form.extra_abs && <label>Fraværstimer<input className="hours" value={form.absence_hours} onChange={e => patch({
          absence_hours: e.target.value,
          work_hours: fmtNum(workHours(form.time_in, form.time_out, form.lunch_min, parseNum(e.target.value) || 0))
        })} /></label>}{form.extra_abs === "Andet – firmabetalt" && <label>Hvilken slags? (kode 50)<select value={form.absence_choice} onChange={e => patch({
          absence_choice: e.target.value
        })}><option value="">— vælg —</option>{(boot.andet_valg || []).map(o => <option key={o}>{o}</option>)}</select></label>}{form.extra_abs === "Andet – egen betalt" && <label>Hvilken slags? (kode 51 — fritekst)<input value={form.absence_note} placeholder="fx privat gøremål …" onChange={e => patch({
          absence_note: e.target.value
        })} /></label>}</div>}{isWorkDay && form.extra_abs && (() => {
      const sum = (parseNum(form.work_hours) || 0) + (parseNum(form.absence_hours) || 0);
      const diff = Math.round((sum - normHours) * 100) / 100;
      return <p className={"small " + (Math.abs(diff) > 0.01 ? "warn" : "muted")}>Arbejde + fravær = {fmtNum(sum)} t{Math.abs(diff) > 0.01 ? ` — afvigelse ${diff > 0 ? "+" : ""}${fmtNum(diff)} t fra normal tid` : " (= normal tid)"}</p>;
    })()}<input className="wide" placeholder="Note om dagen (fx været til kursus, fysio …)" value={form.note} onChange={e => patch({
      note: e.target.value
    })} />{isWorkDay && <><h3>Timefordeling</h3><table className="alloc"><thead><tr><th>Virksomhed/projekt</th>{boot.task_options.length > 0 && <th>Opgavetype</th>}<th>Timer</th><th>Opgavenote</th><th /></tr></thead><tbody>{form.allocations.map((line, idx) => <tr key={idx}><td><select value={line.company_id || ""} onChange={e => updateAlloc(idx, {
                company_id: e.target.value
              })}><option value="">— vælg —</option>{boot.companies.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></td>{boot.task_options.length > 0 && <td><select value={line.task_type} className={missingTask(line) ? "mangler" : ""} onChange={e => updateAlloc(idx, {
                task_type: e.target.value
              })}><option value="">{taskRequired ? "— vælg —" : "—"}</option>{boot.task_options.map(o => <option key={o}>{o}</option>)}{line.task_type && !boot.task_options.includes(line.task_type) && <option value={line.task_type}>{line.task_type} (udgået)</option>}</select></td>}<td><input className="hours" value={line.hours} onChange={e => updateAlloc(idx, {
                hours: e.target.value
              })} /></td><td><input value={line.task_note} onChange={e => updateAlloc(idx, {
                task_note: e.target.value
              })} /></td><td><button className="ghost x" title="Fjern linje" onClick={() => setForm(prev => ({
                ...(prev as DayFormState),
                allocations: (prev as DayFormState).allocations.filter((_l, i) => i !== idx)
              }))}>✕</button></td></tr>)}</tbody></table><div className="row allocbtns"><button className="ghost" onClick={() => setForm(prev => ({
          ...(prev as DayFormState),
          allocations: [...(prev as DayFormState).allocations, {
            company_id: "",
            task_type: "",
            hours: "",
            task_note: ""
          }]
        }))}>➕ Tilføj linje</button>{boot.defaults.length > 0 && <button className="ghost" title="Fordel dagens timer efter din gemte standard" onClick={() => {
          const hours = parseNum(form.work_hours) || 0;
          setForm(prev => ({
            ...(prev as DayFormState),
            allocations: boot.defaults.map(d => ({
              company_id: String(d.company_id),
              task_type: "",
              hours: fmtNum(Math.round(Number(d.share) * hours * 100) / 100),
              task_note: ""
            }))
          }));
        }}>⭐ Brug standardfordeling</button>}<button className="ghost" title="Gem denne fordeling som din standard" onClick={onSaveDefaults}>💾 Gem som standard</button></div><div className="progresswrap"><div className="progressbar"><div style={{
            width: `${pct}%`,
            background: over ? "#ff7b73" : done ? "var(--ok)" : "var(--ice)"
          }} /></div><div className={"progresstext " + (done ? "ok" : over ? "error" : remaining > 0 ? "warn" : "muted")}>{done && `✅ Alle ${fmtNum(total)} timer er fordelt`}{!done && remaining > 0 && `${fmtNum(allocated)} af ${fmtNum(total)} timer fordelt — ${fmtNum(remaining)} tilbage`}{over && `❌ Fordelt ${fmtNum(allocated)} — mere end dagens ${fmtNum(total)} t`}</div></div></>}</section>;
}
