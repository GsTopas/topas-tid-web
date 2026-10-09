import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Boot, type NormDay, type Period } from "../../lib/api";
import { addDays, fmtNum, weekdayIdx } from "../../lib/format";
import { dayNorm, type NormSplit } from "../../lib/norm";
import { fromDbAbsenceType, fromDbPartialAbsence } from "./constants";
import { dayDefaults } from "./normweek";
import { inferLunchMin, workHours } from "./time";
import { formChanged } from "./unsaved";
import type { DayFormState, DayStatusMap, ProxyEmployee, WeeklyNorm } from "./types";

/**
 * Tilstand og effekter for fanen "Min tid". Kaldes i App (ikke i fanens komponent),
 * så tilstanden bevares når man skifter fane — som i originalen.
 */
export function useMinTid(boot: Boot | null) {
  const [dayStatus, setDayStatus] = useState<DayStatusMap>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState<DayFormState | null>(null);
  /** Formularen som den sidst blev hentet eller gemt; afgør om dagen har ikke-gemte ændringer. */
  const [savedForm, setSavedForm] = useState<DayFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [chosenPeriod, setChosenPeriod] = useState<Period | null>(null);
  const [proxyList, setProxyList] = useState<ProxyEmployee[]>([]);
  const [proxyEmp, setProxyEmp] = useState<ProxyEmployee | null>(null);
  const [economyApproved, setEconomyApproved] = useState(false);
  /** Lederens godkendelse af perioden (null = ikke godkendt). */
  const [leaderApproval, setLeaderApproval] = useState<{ name: string | null; at: string | null } | null>(null);

  useEffect(() => {
    if (boot && (boot.employee.is_manager || boot.employee.is_admin)) {
      api.proxyEmployees().then(setProxyList).catch(() => {});
    }
  }, [boot]);

  const period = chosenPeriod || boot?.period;
  /** Den medarbejder der registreres for. */
  const empId = proxyEmp?.id || boot?.employee.id;

  /** Normugen (mødt/gået/frokost pr. ugedag) og dens dagsfordelinger for empId; null indtil de er hentet. */
  const [normWeek, setNormWeek] = useState<{ empId: number; days: NormDay[]; splits: NormSplit[] } | null>(null);
  useEffect(() => {
    if (!empId) {
      return;
    }
    let current = true;
    Promise.all([
      api.normWeek(empId).catch(() => [] as NormDay[]),
      api.normSplits(empId).catch(() => [] as NormSplit[])
    ]).then(([days, splits]) => current && setNormWeek({ empId, days, splits }));
    return () => {
      current = false;
    };
  }, [empId]);
  /** Normugen er hentet for den medarbejder der registreres for. */
  const normDays = normWeek && normWeek.empId === empId ? normWeek.days : null;
  const normSplits = normWeek && normWeek.empId === empId ? normWeek.splits : null;
  /** Hvem normugen sidst blev hentet for (ændres ikke når man gemmer normugen). */
  const normLoadedFor = normWeek?.empId;

  useEffect(() => {
    if (!boot || !period) {
      setEconomyApproved(false);
      setLeaderApproval(null);
      return;
    }
    const empId = proxyEmp?.id || boot.employee.id;
    api.approvalsForPeriod(period.id).then(list => {
      const row = list.find(a => a.employee_id === empId);
      setLeaderApproval(row != null && row.leader_approved ? { name: row.leader_by_name ?? null, at: row.leader_at ?? null } : null);
      return setEconomyApproved(row != null && !!row.economy_approved);
    }).catch(() => {
      setEconomyApproved(false);
      setLeaderApproval(null);
    });
  }, [boot, chosenPeriod, proxyEmp]);

  const days = useMemo(() => {
    if (!period) {
      return [];
    }
    const out: string[] = [];
    let d = period.start_date;
    while (d <= period.end_date) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [period]);

  const weeks = useMemo(() => {
    const out: (string | null)[][] = [];
    let week: (string | null)[] = new Array(7).fill(null);
    for (const d of days) {
      week[weekdayIdx(d)] = d;
      if (weekdayIdx(d) === 6) {
        out.push(week);
        week = new Array(7).fill(null);
      }
    }
    if (week.some(Boolean)) {
      out.push(week);
    }
    return out;
  }, [days]);

  /** Normtimer for datoen (for den medarbejder der registreres for). */
  const normFor = (date: string): number => {
    const norm = (proxyEmp?.weekly_norm ?? boot?.weekly_norm) as WeeklyNorm | null | undefined;
    // Normugens dagsfordeling når den gælder (samme ugesum som kontrakten), ellers kontraktens.
    return norm ? dayNorm(norm, normSplits, date) : 0;
  };

  /** Dato før ansættelsesdato? */
  const beforeHired = (date: string): boolean => {
    const hired = proxyEmp ? proxyEmp.hired_date : boot?.employee?.hired_date;
    return !!hired && !!(date < hired);
  };

  const reloadDays = async (): Promise<DayStatusMap | undefined> => {
    if (!period) {
      return;
    }
    const res = await api.periodDays(period.start_date, period.end_date, proxyEmp?.id);
    const map: DayStatusMap = {};
    for (const e of res.entries) {
      map[e.work_date] = {
        entry: e,
        alloc: 0
      };
    }
    for (const s of res.alloc_sums) {
      map[s.work_date] = map[s.work_date] || {
        entry: null,
        alloc: 0
      };
      map[s.work_date].alloc = Number(s.h);
    }
    setDayStatus(map);
    return map;
  };

  useEffect(() => {
    // Venter på normugens dagsfordeling, så "første manglende dag" regnes med den rigtige dagsnorm.
    if (!!boot && !!period && normLoadedFor === empId) {
      reloadDays().then(map => {
        // Første arbejdsdag til og med i dag uden registrering; ellers i dag / periodens kant.
        const firstMissing = days.find(d => d <= boot.today && normFor(d) > 0 && !beforeHired(d) && (!map || !map[d]?.entry));
        const fallback = period.start_date <= boot.today && boot.today <= period.end_date ? boot.today : period.end_date < boot.today ? period.end_date : period.start_date;
        setSelectedDate(firstMissing || fallback);
      });
    }
  }, [boot, chosenPeriod, proxyEmp, normLoadedFor]);

  useEffect(() => {
    // Venter på normugen, så en tom dag forudfyldes med personens egne tider.
    if (selectedDate && normDays) {
      api.day(selectedDate, proxyEmp?.id).then(res => {
        const entry = res.entry;
        const norm = normFor(selectedDate);
        const normDay = normDays.find(n => n.weekday === weekdayIdx(selectedDate));
        const defaults = dayDefaults(normDay, norm);
        const timeIn = entry?.time_in?.slice(0, 5) || defaults.time_in;
        const timeOut = entry?.time_out?.slice(0, 5) || defaults.time_out;
        const partialAbs = entry != null && entry.location && entry != null && entry.absence_type ? Number(entry.absence_hours || 0) : 0;
        let lunch = defaults.lunch_min;
        if (entry != null && entry.time_in && entry != null && entry.time_out && entry?.work_hours != null) {
          lunch = inferLunchMin(timeIn, timeOut, Number(entry.work_hours), partialAbs);
        }
        const loaded: DayFormState = {
          day_type: entry ? entry.location || fromDbAbsenceType(entry.absence_type, entry.absence_code) || "Ingen" : normDay?.day_off ? "Ingen" : norm > 0 || normDay ? "Kontor" : "Ingen",
          extra_abs: entry != null && entry.location && entry != null && entry.absence_type ? fromDbPartialAbsence(entry.absence_type, entry.absence_code) : "",
          absence_choice: entry?.absence_choice || "",
          location_note: entry?.location_note || "",
          absence_note: entry?.absence_note || "",
          absence_hours: entry?.absence_hours != null ? fmtNum(Number(entry.absence_hours)) : fmtNum(norm),
          time_in: timeIn,
          time_out: timeOut,
          lunch_min: lunch,
          work_hours: fmtNum(workHours(timeIn, timeOut, lunch, partialAbs)),
          note: entry?.note || "",
          allocations: res.allocations.map(a => ({
            company_id: a.company_id,
            task_type: a.task_type || "",
            hours: fmtNum(Number(a.hours)),
            task_note: a.task_note || ""
          }))
        };
        setForm(loaded);
        setSavedForm(loaded);
      });
    }
  }, [selectedDate, proxyEmp, normDays]);

  /** Leder-godkendt låser kun medarbejderen selv: ledere og admin kan stadig rette (håndhæves i RLS). */
  const leaderLocked = leaderApproval != null && !!boot && !boot.employee.is_manager && !boot.employee.is_admin;
  /** Ændringer på dagen der ikke er gemt (i en låst periode kan der ikke gemmes, så dér spørges ikke). */
  const unsaved = !period?.locked && !economyApproved && !leaderLocked && formChanged(form, savedForm);
  /** Glem ændringerne (efter gem, eller når man vælger at fortsætte uden at gemme). */
  const markSaved = () => setSavedForm(form);
  /** Smid ændringerne væk: formularen sættes tilbage til det der sidst blev hentet/gemt. */
  const discardChanges = () => setForm(savedForm);

  /* Påmindelse: skift af dag, periode, medarbejder eller fane med ikke-gemte ændringer spørger først (dialog i MinTid). */
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const guard = (go: () => void) => unsaved ? setPendingNav(() => go) : go();
  /** Sat når man allerede har sagt ja til at forlade siden (fx "Log ud"), så browseren ikke spørger igen. */
  const leaving = useRef(false);
  const allowUnload = () => {
    leaving.current = true;
  };

  useEffect(() => {
    if (!unsaved) {
      return;
    }
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving.current) {
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  return {
    dayStatus,
    selectedDate,
    setSelectedDate,
    form,
    setForm,
    unsaved,
    markSaved,
    discardChanges,
    pendingNav,
    setPendingNav,
    guard,
    allowUnload,
    saving,
    setSaving,
    bulkFrom,
    setBulkFrom,
    bulkTo,
    setBulkTo,
    setChosenPeriod,
    proxyList,
    proxyEmp,
    setProxyEmp,
    economyApproved,
    leaderApproval,
    leaderLocked,
    period,
    days,
    weeks,
    normFor,
    beforeHired,
    reloadDays,
    empId,
    normDays,
    normSplits,
    setNormWeek
  };
}

export type MinTidState = ReturnType<typeof useMinTid>;
