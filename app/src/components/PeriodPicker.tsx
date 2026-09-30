import { useEffect, useRef } from "react";
import type { Period } from "../lib/api";
import { fmtDate } from "../lib/format";

type MultiProps = {
  periods: Period[];
  selIds: Set<Period["id"]>;
  onChange: (ids: Set<Period["id"]>) => void;
};

/** Dropdown med afkrydsning af én eller flere lønperioder. */
export function MultiPeriodPicker({ periods, selIds, onChange }: MultiProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (ev: MouseEvent | KeyboardEvent) => {
      const el = ref.current;
      if (!!el && !!el.open) {
        if (ev.type === "keydown" ? (ev as KeyboardEvent).key === "Escape" : !el.contains(ev.target as Node)) {
          el.open = false;
        }
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  if (!periods.length) {
    return null;
  }
  const toggle = (id: Period["id"]) => {
    const next = new Set(selIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    // Mindst én periode skal altid være valgt
    if (next.size !== 0) {
      onChange(next);
    }
  };
  const today = new Date().toISOString().slice(0, 10);
  const current = periods.find(p => p.start_date <= today && today <= p.end_date);
  const selected = periods.filter(p => selIds.has(p.id));
  const label = selected.length === 1 ? `${selected[0].month_name} ${selected[0].year}` : `${selected.length} perioder: ${selected[0].month_name}–${selected[selected.length - 1].month_name}`;
  return <details className="mpick" ref={ref}><summary>📅 {label} ▾</summary><div className="mpick-list"><div className="mpick-head"><span>Kryds én eller flere lønperioder af</span>{current && <button type="button" className="ghost" onClick={() => onChange(new Set([current.id]))}>Kun {current.month_name}</button>}</div>{periods.map(p => <label className={selIds.has(p.id) ? "sel" : ""} key={p.id}><input type="checkbox" checked={selIds.has(p.id)} onChange={() => toggle(p.id)} /><span className="mp-navn">{p.month_name} {p.year}</span><span className="mp-datoer">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}{p.locked ? " 🔒" : ""}</span></label>)}</div></details>;
}

type SelectProps = {
  periods: Period[];
  sel: Period | null | undefined;
  onChange: (p: Period) => void;
};

/** Enkeltvalg af lønperiode. */
export function PeriodSelect({ periods, sel, onChange }: SelectProps) {
  if (sel) {
    return <select className="periodpick" value={sel.id} onChange={ev => onChange(periods.find(p => String(p.id) === ev.target.value)!)}>{periods.map(p => <option value={p.id} key={p.id}>{p.month_name} {p.year} ({fmtDate(p.start_date)} – {fmtDate(p.end_date)}){p.locked ? " 🔒" : ""}</option>)}</select>;
  } else {
    return null;
  }
}
