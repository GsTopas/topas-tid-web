import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { parseNum } from "../../lib/format";
import { DEPARTMENTS, SaveAllBar, keepDirty, randomTempPassword, saveDirtyRows, splitWeeklyNorm, sumNorm, useDirtyRows } from "./shared";

type Employee = Awaited<ReturnType<typeof api.employeesAll>>[number];

type EditedFields =
  | "name"
  | "email"
  | "department"
  | "hourly_rate"
  | "hired_date"
  | "payroll_number"
  | "flex_start"
  | "is_admin"
  | "is_manager"
  | "active";

/** En medarbejder-række mens den redigeres: talfelter kan midlertidigt være tekst fra input-felterne. */
type EmployeeRow = Omit<Employee, EditedFields> & {
  name: string;
  email: string | null;
  department: string | null;
  hourly_rate: number | string;
  hired_date: string | null;
  payroll_number: number | string | null;
  flex_start: number | string | null;
  is_admin: boolean;
  is_manager: boolean;
  active: boolean;
  /** Redigeret Norm/uge-tekst (kun sat når brugeren har rørt feltet). */
  norm_uge?: string;
};

type NewEmployee = {
  name: string;
  email: string;
  department: string;
  rate: string;
  norm: string;
  nr: string;
  saldo: string;
  admin: boolean;
  leder: boolean;
  hired: string;
};

/** Er Norm/uge ændret i forhold til den gemte dagsfordeling? (`$j`) */
const normChanged = (p: EmployeeRow): boolean =>
  p.norm_uge != null &&
  String(p.norm_uge).trim() !== "" &&
  Math.abs((parseNum(String(p.norm_uge)) ?? 0) - sumNorm(p.weekly_norm)) > 0.001;

const parsePayrollNumber = (v: unknown): number | null =>
  String(v ?? "").trim() === "" ? null : Number.isInteger(Number(v)) ? Number(v) : null;

export function Medarbejdere({ flash }: { flash: (msg: string) => void }) {
  const [rows, setRows] = useState<EmployeeRow[] | null>(null);
  const [draft, setDraft] = useState<NewEmployee | null>(null);
  const [pwInfo, setPwInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const edits = useDirtyRows<EmployeeRow["id"]>();
  // Ikke-gemte rækker bevares ved genindlæsning (fx efter "Opret login"); login-status kommer fra databasen.
  const load = () => api.employeesAll().then(list =>
    setRows(prev => keepDirty(list as EmployeeRow[], prev, edits.current(), (f, l) => ({ ...l, auth_user_id: f.auth_user_id }))));
  useEffect(() => {
    load();
  }, []);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const patch = (id: EmployeeRow["id"], changes: Partial<EmployeeRow>) => {
    setRows(rows.map(d => d.id === id ? { ...d, ...changes } : d));
    edits.mark(id);
  };
  const saveOne = (p: EmployeeRow) =>
    api.saveEmployee(p.id, {
        name: p.name,
        email: (p.email || "").trim().toLowerCase() || null,
        department: p.department || null,
        is_admin: p.is_admin,
        is_manager: p.is_manager,
        active: p.active,
        hourly_rate: parseNum(String(p.hourly_rate)) ?? 0,
        hired_date: p.hired_date || null,
        payroll_number: parsePayrollNumber(p.payroll_number),
        flex_start: parseNum(String(p.flex_start ?? 0)) ?? 0,
        ...(normChanged(p) ? { weekly_norm: splitWeeklyNorm(parseNum(String(p.norm_uge))) } : {})
      });
  const saveAll = async () => {
    setSaving(true);
    const failed = await saveDirtyRows(rows, edits.dirty, saveOne, flash);
    edits.reset(failed);
    setSaving(false);
    load();
  };
  const undo = () => {
    edits.reset();
    api.employeesAll().then(list => setRows(list as EmployeeRow[]));
  };
  const manageLogin = async (p: EmployeeRow, action: "create" | "reset") => {
    const password = randomTempPassword();
    try {
      // NOTE(recovery): email sendes som den er (kan i teorien være null ved "reset"), som i originalen.
      await api.manageLogin(action, p.email as string, password);
      setPwInfo(`${p.email} → midlertidigt password: ${password}`);
      load();
    } catch (w) {
      flash("❌ " + (w as Error).message);
    }
  };
  return <div>{pwInfo && <p className="ok pwinfo">🔑 {pwInfo} — skriv det ned, det vises kun her!</p>}<div className="tablewrap"><table className="datatable admin"><thead><tr><th>Navn</th><th>Mail</th><th>Afdeling</th><th className="num">Timepris</th><th>Startdato</th><th className="num">Lønnr.</th><th className="num" title="Flex-saldo ved start (timer, kan være negativ)">Start saldo</th><th className="num" title="Normtid pr. uge — sæt ned ved deltid. Fordeles automatisk man–fre">Norm/uge</th><th>Admin</th><th>Leder</th><th>Aktiv</th><th>Login</th></tr></thead><tbody>{rows.map(p => <tr className={p.active ? "" : "inaktiv"} key={p.id}><td><input value={p.name} onChange={g => patch(p.id, {
                name: g.target.value
              })} /></td><td><input value={p.email || ""} onChange={g => patch(p.id, {
                email: g.target.value
              })} /></td><td><select value={p.department || ""} onChange={g => patch(p.id, {
                department: g.target.value
              })}><option value="">—</option>{DEPARTMENTS.map(g => <option key={g}>{g}</option>)}</select></td><td><input className="hours" value={String(p.hourly_rate).replace(".", ",")} onChange={g => patch(p.id, {
                hourly_rate: g.target.value
              })} /></td><td><input type="date" title="Dage før startdatoen tæller ikke som manglende" value={p.hired_date || ""} onChange={g => patch(p.id, {
                hired_date: g.target.value
              })} /></td><td><input className="hours" inputMode="numeric" title="Medarbejdernummer i lønsystemet (Lessor)" placeholder="fx 10012" value={p.payroll_number ?? ""} onChange={g => patch(p.id, {
                payroll_number: g.target.value
              })} /></td><td><input className="hours" title="Flex-saldo ved start (timer)" value={String(p.flex_start ?? 0).replace(".", ",")} onChange={g => patch(p.id, {
                flex_start: g.target.value
              })} /></td><td><input className="hours" title={"Dagsfordeling: " + (Array.isArray(p.weekly_norm) ? (p.weekly_norm as unknown[]).slice(0, 5).map(g => String(g).replace(".", ",")).join(" / ") : "")} value={p.norm_uge ?? String(sumNorm(p.weekly_norm)).replace(".", ",")} onChange={g => patch(p.id, {
                norm_uge: g.target.value
              })} /></td><td><input type="checkbox" checked={p.is_admin} onChange={g => patch(p.id, {
                is_admin: g.target.checked
              })} /></td><td><input type="checkbox" checked={p.is_manager} onChange={g => patch(p.id, {
                is_manager: g.target.checked
              })} /></td><td><input type="checkbox" checked={p.active} onChange={g => patch(p.id, {
                active: g.target.checked
              })} /></td><td>{p.auth_user_id ? <button className="ghost" onClick={() => manageLogin(p, "reset")}>Nulstil pw</button> : p.email ? <button className="ghost" onClick={() => manageLogin(p, "create")}>Opret login</button> : <span className="muted">mangler mail</span>}</td></tr>)}</tbody></table></div><SaveAllBar count={edits.dirty.size} saving={saving} onSave={saveAll} onUndo={undo} />{draft ? <div className="nyrow"><input placeholder="Navn" value={draft.name} onChange={p => setDraft({
        ...draft,
        name: p.target.value
      })} /><input placeholder="mail@topas.dk" value={draft.email} onChange={p => setDraft({
        ...draft,
        email: p.target.value
      })} /><select value={draft.department} onChange={p => setDraft({
        ...draft,
        department: p.target.value
      })}>{DEPARTMENTS.map(p => <option key={p}>{p}</option>)}</select><input className="hours" placeholder="Timepris" value={draft.rate} onChange={p => setDraft({
        ...draft,
        rate: p.target.value
      })} /><input type="date" title="Startdato" value={draft.hired} onChange={p => setDraft({
        ...draft,
        hired: p.target.value
      })} /><input className="hours" inputMode="numeric" placeholder="Lønnr." title="Medarbejdernummer i lønsystemet (Lessor)" value={draft.nr} onChange={p => setDraft({
        ...draft,
        nr: p.target.value
      })} /><input className="hours" placeholder="Start saldo" title="Flex-saldo ved start (timer)" value={draft.saldo} onChange={p => setDraft({
        ...draft,
        saldo: p.target.value
      })} /><input className="hours" placeholder="Norm/uge" title="Normtid pr. uge (37 = fuld tid)" value={draft.norm} onChange={p => setDraft({
        ...draft,
        norm: p.target.value
      })} /><label title="Ser og redigerer alt"><input type="checkbox" checked={!!draft.admin} onChange={p => setDraft({
          ...draft,
          admin: p.target.checked
        })} /> Admin</label><label title="Godkender egen afdeling, opretter dens opgavetyper"><input type="checkbox" checked={!!draft.leder} onChange={p => setDraft({
          ...draft,
          leder: p.target.checked
        })} /> Leder</label><button className="primary" onClick={async () => {
        try {
          await api.saveEmployee(null, {
            name: draft.name,
            email: (draft.email || "").trim().toLowerCase() || null,
            department: draft.department,
            hourly_rate: parseNum(draft.rate) ?? 0,
            is_admin: !!draft.admin,
            is_manager: !!draft.leder,
            active: true,
            weekly_norm: splitWeeklyNorm(parseNum(draft.norm) ?? 37),
            flex_start: parseNum(String(draft.saldo ?? "0")) ?? 0,
            payroll_number: parsePayrollNumber(draft.nr),
            hired_date: draft.hired || null
          });
          setDraft(null);
          flash("Medarbejder oprettet ✓");
          load();
        } catch (p) {
          flash("❌ " + (p as Error).message);
        }
      }}>Opret</button><button className="ghost" onClick={() => setDraft(null)}>Fortryd</button></div> : <button className="ghost" onClick={() => setDraft({
      name: "",
      email: "",
      department: "Marketing",
      rate: "500",
      norm: "37",
      nr: "",
      saldo: "0",
      admin: false,
      leder: false,
      hired: new Date().toISOString().slice(0, 10)
    })}>➕ Ny medarbejder</button>}<p className="muted small">Norm/uge fordeles automatisk man–fre i kvarter (37 = 7,5/7,5/7,5/7,5/7 t; 30 = 6 t om dagen) — sæt den ned ved deltid. Start saldo = flex-saldo ved start. Opret login bagefter i Login-kolonnen.</p></div>;
}
