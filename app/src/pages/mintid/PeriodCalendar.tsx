import { ABSENCE_ICONS, WEEKDAYS_SHORT } from "./constants";
import type { DayStatusMap } from "./types";

/**
 * Statusikon for en dag i kalenderen:
 * fravær > arbejde → fraværsikon, fuldt fordelt → 🟢, ellers 🟠; manglende arbejdsdag til og med i dag → 🔴.
 */
export function dayStatusIcon(date: string, dayStatus: DayStatusMap, isOff: boolean, today: string): string {
  const s = dayStatus[date];
  if (s != null && s.entry) {
    const e = s.entry;
    if (e.location) {
      const worked = Number(e.work_hours || 0);
      if (e.absence_type && Number(e.absence_hours || 0) > worked) {
        return ABSENCE_ICONS[String(e.absence_type)] || "📋";
      } else if (worked > 0 && Math.abs((s.alloc || 0) - worked) <= 0.01) {
        return "🟢";
      } else {
        return "🟠";
      }
    }
    return ABSENCE_ICONS[String(e.absence_type)] || "📋";
  }
  if (isOff) {
    return "";
  } else if (date <= today) {
    return "🔴";
  } else {
    return "";
  }
}

type Props = {
  weeks: (string | null)[][];
  selectedDate: string | null;
  today: string;
  isOff: (date: string) => boolean;
  icon: (date: string) => string;
  onSelect: (date: string) => void;
};

export function PeriodCalendar({ weeks, selectedDate, today, isOff, icon, onSelect }: Props) {
  return <>
    <div className="calhead">{WEEKDAYS_SHORT.map(d => <span key={d}>{d}</span>)}</div>
    {weeks.map((week, wi) => <div className="weekrow" key={wi}>{week.map((d, di) => d ? <div className={"daycard" + (d === selectedDate ? " sel" : "") + (d === today ? " today" : "") + (isOff(d) ? " off" : "")} onClick={() => onSelect(d)} key={d}><div className="num">{Number(d.slice(8, 10))}</div><span className="st">{icon(d)}</span></div> : <div key={`tom-${wi}-${di}`} />)}</div>)}
  </>;
}
