import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { api } from "../lib/api";
import type { Period } from "../lib/api";

/** Samlet "periode" for et udvalg af lønperioder. */
export type MultiPeriod = {
  id: string;
  start_date: string;
  end_date: string;
  month_name: string;
  year: Period["year"];
  locked: boolean;
  enkelt: Period | null;
};

/** Periodeliste + valgt periode (dagens periode, ellers den sidste). */
export function usePeriod(): [Period[], Period | null, Dispatch<SetStateAction<Period | null>>] {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [sel, setSel] = useState<Period | null>(null);
  useEffect(() => {
    api.periods().then(list => {
      setPeriods(list);
      const today = new Date().toISOString().slice(0, 10);
      setSel(list.find(p => p.start_date <= today && today <= p.end_date) || list[list.length - 1]);
    });
  }, []);
  return [periods, sel, setSel];
}

/** Periodeliste + sæt af valgte periode-id'er + samlet periode + reload. */
export function useMultiPeriod(): [
  Period[],
  Set<Period["id"]>,
  Dispatch<SetStateAction<Set<Period["id"]>>>,
  MultiPeriod | null,
  () => Promise<void>
] {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selIds, setSelIds] = useState<Set<Period["id"]>>(new Set());
  const reload = () => api.periods().then(setPeriods);
  useEffect(() => {
    api.periods().then(list => {
      setPeriods(list);
      const today = new Date().toISOString().slice(0, 10);
      const current = list.find(p => p.start_date <= today && today <= p.end_date) || list[list.length - 1];
      if (current) {
        setSelIds(new Set([current.id]));
      }
    });
  }, []);
  const selected = periods.filter(p => selIds.has(p.id));
  const combined: MultiPeriod | null = selected.length ? {
    id: selected.map(p => p.id).join("+"),
    start_date: selected.reduce((acc, p) => p.start_date < acc ? p.start_date : acc, selected[0].start_date),
    end_date: selected.reduce((acc, p) => p.end_date > acc ? p.end_date : acc, selected[0].end_date),
    month_name: selected.length === 1 ? selected[0].month_name : `${selected[0].month_name}–${selected[selected.length - 1].month_name}`,
    year: selected[0].year,
    locked: selected.every(p => p.locked),
    enkelt: selected.length === 1 ? selected[0] : null
  } : null;
  return [periods, selIds, setSelIds, combined, reload];
}
