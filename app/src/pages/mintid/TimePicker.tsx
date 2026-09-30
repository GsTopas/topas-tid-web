/** Time:minut-vælger (minutter i 5-min-trin, plus en evt. afvigende værdi). */
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hh, mm] = (value || "08:00").split(":");
  const minuteOptions = [...new Set([...Array.from({
    length: 12
  }, (_s, a) => String(a * 5).padStart(2, "0")), mm])].sort();
  return <span className="tid15"><select value={hh} onChange={s => onChange(`${s.target.value}:${mm}`)}>{Array.from({
        length: 24
      }, (_s, a) => String(a).padStart(2, "0")).map(s => <option key={s}>{s}</option>)}</select><b>:</b><select value={mm} onChange={s => onChange(`${hh}:${s.target.value}`)}>{minuteOptions.map(s => <option key={s}>{s}</option>)}</select></span>;
}
