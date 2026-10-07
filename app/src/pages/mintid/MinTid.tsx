import type { Dispatch, SetStateAction } from "react";
import { api, type Boot, type Period, type SessionEmployee } from "../../lib/api";
import { addDays, fmtDate, fmtNum, parseNum, weekdayIdx } from "../../lib/format";
import { PeriodSelect } from "../../components/PeriodPicker";
import { ABSENCE_TYPES, absenceCodeFor, toDbDayType, WEEKDAYS_LONG, WORK_DAY_TYPES } from "./constants";
import { DayForm, type FormTotals } from "./DayForm";
import { dayStatusIcon, PeriodCalendar } from "./PeriodCalendar";
import type { AllocLine, DayFormState, DayPayload } from "./types";
import type { MinTidState } from "./useMinTid";

type Props = {
  mt: MinTidState;
  /** Den valgte (eller aktuelle) lønperiode; App viser "Ingen aktiv lønperiode." når den mangler. */
  period: Period;
  boot: Boot;
  setBoot: Dispatch<SetStateAction<Boot | null>>;
  emp: SessionEmployee;
  periods: Period[];
  flash: (msg: string) => void;
};

/** Fanen "⏱️ Min tid": periodelinje, kalender, dagsformular, flere dage på én gang og gem-bjælke. */
export function MinTid({ mt, period, boot, setBoot, emp, periods, flash }: Props) {
  const { dayStatus, form, setForm, saving, setSaving, bulkFrom, setBulkFrom, bulkTo, setBulkTo, proxyList, proxyEmp, setProxyEmp, economyApproved, normFor, beforeHired, reloadDays } = mt;
  const selectedDate = mt.selectedDate as string;

  const isWorkDay = form && WORK_DAY_TYPES.includes(form.day_type);
  const isAbsenceDay = form && ABSENCE_TYPES.includes(form.day_type);
  const total = isWorkDay && parseNum(form.work_hours) || 0;
  const allocated = form ? form.allocations.reduce((sum, l) => sum + (parseNum(l.hours) || 0), 0) : 0;
  const remaining = Math.round((total - allocated) * 100) / 100;
  const pct = total > 0 ? Math.min(allocated / total * 100, 100) : 0;
  const over = total > 0 && allocated - total > 0.01;
  const done = total > 0 && Math.abs(remaining) <= 0.01;
  const taskRequired = boot.task_options.length > 0 && emp.department !== "Hotel & Administration";
  const missingTask = (line: AllocLine): boolean => !!(taskRequired && line.company_id && (parseNum(line.hours) || 0) > 0 && !line.task_type);
  const isOff = (d: string) => normFor(d) <= 0 || beforeHired(d);

  const patch = (p: Partial<DayFormState>) => setForm(prev => ({
    ...(prev as DayFormState),
    ...p
  }));
  const partialAbsence = () => form != null && form.extra_abs && parseNum(form.absence_hours) || 0;
  const updateAlloc = (idx: number, p: Partial<AllocLine>) => setForm(prev => {
    const allocations = (prev as DayFormState).allocations.map((l, i) => i === idx ? {
      ...l,
      ...p
    } : l);
    return {
      ...(prev as DayFormState),
      allocations
    };
  });

  /** Formularen → payload til api.saveDay for en given dato. */
  const buildPayload = (date: string): DayPayload => {
    const h = form as DayFormState;
    const absType = isWorkDay ? h.extra_abs : h.day_type;
    const code = absType ? absenceCodeFor(absType) : null;
    return {
      work_date: date,
      day_type: toDbDayType(h.day_type),
      location_note: h.location_note || null,
      absence_note: h.absence_note || null,
      extra_abs: isWorkDay && h.extra_abs ? toDbDayType(h.extra_abs) : null,
      absence_code: code,
      absence_choice: code === "50" && h.absence_choice || null,
      absence_hours: isAbsenceDay || isWorkDay && h.extra_abs ? parseNum(h.absence_hours) : null,
      time_in: isWorkDay ? h.time_in : null,
      time_out: isWorkDay ? h.time_out : null,
      work_hours: isWorkDay ? parseNum(h.work_hours) : null,
      note: h.note || null,
      allocations: isWorkDay ? h.allocations.filter(l => l.company_id && (parseNum(l.hours) || 0) > 0).map(l => ({
        company_id: Number(l.company_id),
        task_type: l.task_type || "",
        hours: parseNum(l.hours),
        task_note: l.task_note || null
      })) : []
    };
  };

  /** Gem samme indhold på alle arbejdsdage i intervallet. */
  const saveRange = async () => {
    const from = bulkFrom || selectedDate;
    const to = bulkTo || selectedDate;
    if (to < from) {
      return flash("❌ 'Til'-datoen er før 'Fra'-datoen");
    }
    if (isWorkDay && (form as DayFormState).allocations.some(missingTask)) {
      return flash("❌ Vælg opgavetype på alle timelinjer — opgavetype er obligatorisk");
    }
    setSaving(true);
    try {
      let count = 0;
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (!(normFor(d) <= 0) && !beforeHired(d)) {
          await api.saveDay(buildPayload(d), proxyEmp?.id);
          count++;
        }
      }
      await reloadDays();
      if (from <= selectedDate && selectedDate <= to && !isOff(selectedDate)) {
        mt.markSaved();
      }
      flash(`✓ ${count} dage gemt (${fmtDate(from)} – ${fmtDate(to)})`);
    } catch (err) {
      flash("❌ " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /** Gem dagens fordeling som andele (standardfordeling). */
  const saveDefaults = async () => {
    const lines = (form as DayFormState).allocations.filter(l => l.company_id && (parseNum(l.hours) || 0) > 0).map(l => ({
      company_id: Number(l.company_id),
      hours: parseNum(l.hours) as number
    }));
    const sum = lines.reduce((acc, l) => acc + l.hours, 0);
    if (!sum) {
      return flash("❌ Udfyld fordelingen først");
    }
    const shares = lines.map(l => ({
      company_id: l.company_id,
      share: l.hours / sum
    }));
    try {
      await api.saveDefaults(shares);
      setBoot(prev => ({
        ...(prev as Boot),
        defaults: shares
      }));
      flash("⭐ Gemt som din standardfordeling");
    } catch (err) {
      flash("❌ " + (err as Error).message);
    }
  };

  /** Gemmer den valgte dag; giver kalenderstatus tilbage, eller null hvis den ikke blev gemt. */
  const persistDay = async () => {
    if (isWorkDay && (form as DayFormState).allocations.some(missingTask)) {
      flash("❌ Vælg opgavetype på alle timelinjer — opgavetype er obligatorisk");
      return null;
    }
    setSaving(true);
    try {
      await api.saveDay(buildPayload(selectedDate), proxyEmp?.id);
      const map = await reloadDays();
      mt.markSaved();
      if (isWorkDay && Math.abs(remaining) > 0.01) {
        flash(`⚠️ Gemt — men kun ${fmtNum(allocated)} af ${fmtNum(total)} t er fordelt`);
      } else {
        flash(`${fmtDate(selectedDate)} gemt ✓`);
      }
      return map || {};
    } catch (err) {
      flash("❌ " + (err as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveDay = async () => {
    const map = await persistDay();
    if (map && !(isWorkDay && Math.abs(remaining) > 0.01)) {
      // Hop videre til næste arbejdsdag (til og med i dag) uden registrering.
      // NOTE(recovery): her tjekkes ikke ansættelsesdato (i modsætning til ved periodeskift) — bevaret.
      const next = mt.days.find(d => d > selectedDate && d <= boot.today && normFor(d) > 0 && (map[d] == null || !map[d].entry));
      if (next) {
        mt.setSelectedDate(next);
      }
    }
  };

  /* Påmindelse om ikke-gemt dag (tilstanden ligger i useMinTid, så også fanerne i App kan spørge). */
  const { pendingNav, setPendingNav, guard } = mt;
  const stay = () => setPendingNav(null);
  const discardAndGo = () => {
    mt.discardChanges();
    setPendingNav(null);
    pendingNav?.();
  };
  const saveAndGo = async () => {
    const go = pendingNav;
    const map = await persistDay();
    setPendingNav(null);
    if (map) {
      go?.();
    }
  };

  const locked = period.locked || economyApproved;
  const totals: FormTotals = {
    isWorkDay: !!isWorkDay,
    isAbsenceDay: !!isAbsenceDay,
    total,
    allocated,
    remaining,
    pct,
    over,
    done,
    taskRequired
  };

  return <>
    <div className="row periodline">{periods.length > 0 ? <PeriodSelect periods={periods} sel={period} onChange={p => guard(() => {
        mt.setChosenPeriod(p);
        setBulkFrom("");
        setBulkTo("");
      })} /> : <span className="muted">{period.month_name} {period.year} · {fmtDate(period.start_date)} – {fmtDate(period.end_date)}</span>}{proxyList.length > 1 && <select className="proxysel" value={proxyEmp?.id || ""} onChange={e => {
        const id = Number(e.target.value);
        guard(() => setProxyEmp(id && id !== boot.employee.id && proxyList.find(p => p.id === id) || null));
      }}><option value="">Registrerer for: mig selv</option>{proxyList.filter(p => p.id !== boot.employee.id).map(p => <option value={p.id} key={p.id}>Registrerer for: {p.name}</option>)}</select>}{period.locked && <span className="warn">🔒 Låst af økonomi — kan ses, men ikke rettes</span>}{!period.locked && economyApproved && <span className="warn">🔒 {proxyEmp ? proxyEmp.name + " er" : "Du er"} godkendt af økonomi for denne periode — kan ikke rettes</span>}</div>
    <PeriodCalendar weeks={mt.weeks} selectedDate={mt.selectedDate} today={boot.today} isOff={isOff} icon={d => dayStatusIcon(d, dayStatus, isOff(d), boot.today)} onSelect={d => d !== mt.selectedDate && guard(() => mt.setSelectedDate(d))} />
    {form && <DayForm form={form} setForm={setForm} date={selectedDate} boot={boot} normHours={normFor(selectedDate)} totals={totals} patch={patch} updateAlloc={updateAlloc} missingTask={missingTask} partialAbsence={partialAbsence} onSaveDefaults={saveDefaults} />}
    {form && <details className="bulk"><summary>🗓️ Registrér flere dage på én gang</summary><p className="muted small">Udfyld dagen ovenfor (fx Ferie eller Kontor med fordeling), vælg et interval — samme indhold gemmes på alle hverdage i intervallet.</p><div className="row"><label>Fra<input type="date" value={bulkFrom || selectedDate} min={period.start_date} max={period.end_date} onChange={e => setBulkFrom(e.target.value)} /></label><label>Til<input type="date" value={bulkTo || selectedDate} min={period.start_date} max={period.end_date} onChange={e => setBulkTo(e.target.value)} /></label><button className="primary" disabled={saving || locked} onClick={saveRange}>{locked ? "🔒 Låst" : saving ? "Gemmer…" : "💾 Gem dagene"}</button></div></details>}
    {form && <div className="savebar"><span className="muted">{WEEKDAYS_LONG[weekdayIdx(selectedDate)]} {fmtDate(selectedDate)}{isWorkDay && ` · ${fmtNum(allocated)} / ${fmtNum(total)} t fordelt`}</span><button className="primary" disabled={saving || locked} onClick={saveDay}>{locked ? "🔒 Perioden er låst" : saving ? "Gemmer…" : "💾 Gem dagen"}</button></div>}
    {pendingNav && <div className="modal-backdrop" onClick={stay} onKeyDown={e => e.key === "Escape" && stay()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="ikkegemt-titel" onClick={e => e.stopPropagation()}><h3 id="ikkegemt-titel">Du har ikke gemt din dag</h3><p className="muted">{WEEKDAYS_LONG[weekdayIdx(selectedDate)]} {fmtDate(selectedDate)} har ændringer, der ikke er gemt. Vil du gemme dagen?</p><div className="modal-actions"><button className="ghost" onClick={stay}>Bliv på dagen</button><button className="ghost" onClick={discardAndGo}>Fortsæt uden at gemme</button><button className="primary" autoFocus disabled={saving} onClick={saveAndGo}>{saving ? "Gemmer…" : "💾 Gem og fortsæt"}</button></div></div></div>}
  </>;
}
