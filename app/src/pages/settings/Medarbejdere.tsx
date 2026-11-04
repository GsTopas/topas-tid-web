import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { fmtDate, fmtNum, parseNum } from "../../lib/format";
import type { NormSplit } from "../../lib/norm";
import type { HourCredit, Period } from "../../lib/api";
import { TilskrevneTimer } from "./TilskrevneTimer";
import { isSimpleDepartment } from "../../lib/departments";
import { DEPARTMENTS, SaveAllBar, keepDirty, randomTempPassword, saveDirtyRows, splitWeeklyNorm, sumNorm, useDirtyRows } from "./shared";

type Employee = Awaited<ReturnType<typeof api.employeesAll>>[number];
type Company = Awaited<ReturnType<typeof api.companiesAll>>[number];

/** Filter på "Ansat i": "" = alle, "none" = ikke angivet, ellers selskabets id. */
type EmployerFilter = string;
type SortKey = "name" | "employer" | "department";

/** Enkel visning (fx Topas Travel) viderefakturerer ikke: timeprisen er tom og gemmes som 0. */
const NO_RATE_TITLE = "Afdelingen viderefakturerer ikke, så den har ingen timepris";

type EditedFields =
  | "name"
  | "email"
  | "department"
  | "employer_company_id"
  | "hourly_rate"
  | "hired_date"
  | "payroll_number"
  | "flex_start"
  | "is_admin"
  | "is_manager"
  | "approves_all_departments"
  | "active";

/** En medarbejder-række mens den redigeres: talfelter kan midlertidigt være tekst fra input-felterne. */
type EmployeeRow = Omit<Employee, EditedFields> & {
  name: string;
  email: string | null;
  department: string | null;
  employer_company_id: number | null;
  hourly_rate: number | string;
  hired_date: string | null;
  payroll_number: number | string | null;
  flex_start: number | string | null;
  is_admin: boolean;
  is_manager: boolean;
  approves_all_departments: boolean;
  active: boolean;
  /** Redigeret Norm/uge-tekst (kun sat når brugeren har rørt feltet). */
  norm_uge?: string;
  /** Startdatoen på lønperioden, den nye Norm/uge gælder fra (standard: den aktuelle periode). */
  norm_fra?: string;
};

type NewEmployee = {
  name: string;
  email: string;
  department: string;
  employer: string;
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
  /** Pop-up for "Opret login" / "Nulstil pw": bekræft først, vis derefter det midlertidige password. */
  const [loginDlg, setLoginDlg] = useState<{ p: EmployeeRow; action: "create" | "reset"; password?: string; busy?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employerFilter, setEmployerFilter] = useState<EmployerFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const edits = useDirtyRows<EmployeeRow["id"]>();
  const [periods, setPeriods] = useState<Period[]>([]);
  /** Normtidens historik (norm_contract) pr. medarbejder. */
  const [history, setHistory] = useState<Record<number, NormSplit[]>>({});
  const [credits, setCredits] = useState<HourCredit[]>([]);
  /** Medarbejderen hvis tilskrevne timer vises under tabellen. */
  const [creditEmp, setCreditEmp] = useState<EmployeeRow["id"] | null>(null);
  const loadHistory = () => api.normSplits().then(list => {
    const out: Record<number, NormSplit[]> = {};
    for (const c of list.filter(x => x.contract)) {
      (out[c.employee_id] = out[c.employee_id] || []).push(c);
    }
    setHistory(out);
  }).catch(() => {});
  const loadCredits = () => api.hourCredits().then(setCredits).catch(() => {});
  // Ikke-gemte rækker bevares ved genindlæsning (fx efter "Opret login"); login-status kommer fra databasen.
  const load = () => api.employeesAll().then(list =>
    setRows(prev => keepDirty(list as EmployeeRow[], prev, edits.current(), (f, l) => ({ ...l, auth_user_id: f.auth_user_id }))));
  useEffect(() => {
    load();
    api.companiesAll().then(setCompanies);
    api.periods().then(setPeriods).catch(() => {});
    loadHistory();
    loadCredits();
  }, []);
  if (!rows) {
    return <p className="muted">Henter…</p>;
  }
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = periods.find(p => p.start_date <= today && today <= p.end_date) || periods[periods.length - 1];
  // Valgmuligheder for "gælder fra": lønperioder fra sidste år og frem.
  const fromOptions = periods.filter(p => p.year >= Number(today.slice(0, 4)) - 1);
  const periodName = (start: string) => {
    const p = periods.find(x => x.start_date === start);
    return p ? `${p.month_name} ${p.year}` : fmtDate(start);
  };
  const historyText = (id: EmployeeRow["id"]) => {
    const list = (history[id] || []).slice().sort((a, b) => a.valid_from.localeCompare(b.valid_from));
    return list.length > 1
      ? "\nNormtid over tid: " + list.map(c => `${fmtNum(sumNorm(c.weekly_norm))} t ${c.valid_from <= "1900-01-01" ? "fra start" : "fra " + periodName(c.valid_from) + " (" + fmtDate(c.valid_from) + ")"}`).join(", ")
      : "";
  };
  /** Planlagt normtid der endnu ikke gælder (valid_from efter i dag). */
  const upcoming = (id: EmployeeRow["id"]) => (history[id] || []).filter(c => c.valid_from > today).sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0];
  const yearCredits = (id: EmployeeRow["id"]) => {
    const ids = new Set(periods.filter(p => p.year === Number(today.slice(0, 4))).map(p => p.id));
    return credits.filter(c => c.employee_id === id && ids.has(c.period_id)).reduce((sum, c) => sum + c.hours, 0);
  };
  const companyName = (id: number | null) => (id == null ? "" : companies.find(c => c.id === id)?.name ?? "");
  // Valgmuligheder: aktive selskaber, plus det allerede valgte selv om det er inaktivt.
  const employerOptions = (current: number | null) =>
    companies.filter(c => c.kind === "selskab" && (c.active || c.id === current));
  const shown = rows
    .filter(p =>
      employerFilter === "" ? true : employerFilter === "none" ? p.employer_company_id == null : p.employer_company_id === Number(employerFilter))
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      // Tomme værdier sidst; ellers stabil (indlæst rækkefølge = navn).
      const key = (p: EmployeeRow) => sortKey === "employer" ? companyName(p.employer_company_id) : sortKey === "department" ? p.department || "" : "";
      const ka = key(a.p), kb = key(b.p);
      if (ka !== kb) {
        return ka === "" ? 1 : kb === "" ? -1 : ka.localeCompare(kb, "da");
      }
      return a.i - b.i;
    })
    .map(x => x.p);
  const patch = (id: EmployeeRow["id"], changes: Partial<EmployeeRow>) => {
    setRows(rows.map(d => d.id === id ? { ...d, ...changes } : d));
    edits.mark(id);
  };
  const saveOne = (p: EmployeeRow) =>
    api.saveEmployee(p.id, {
        name: p.name,
        email: (p.email || "").trim().toLowerCase() || null,
        department: p.department || null,
        employer_company_id: p.employer_company_id ?? null,
        is_admin: p.is_admin,
        is_manager: p.is_manager,
        approves_all_departments: p.approves_all_departments,
        active: p.active,
        hourly_rate: isSimpleDepartment(p.department) ? 0 : parseNum(String(p.hourly_rate)) ?? 0,
        hired_date: p.hired_date || null,
        payroll_number: parsePayrollNumber(p.payroll_number),
        flex_start: parseNum(String(p.flex_start ?? 0)) ?? 0
      }).then(async () => {
        // Ny normtid gælder kun fra den valgte lønperiode; tidligere perioder beholder den gamle.
        if (normChanged(p)) {
          const from = p.norm_fra || currentPeriod?.start_date;
          if (!from) {
            throw new Error("Vælg hvilken lønperiode den nye normtid gælder fra");
          }
          await api.saveNormContract(p.id, from, splitWeeklyNorm(parseNum(String(p.norm_uge))));
        }
      });
  const saveAll = async () => {
    setSaving(true);
    const failed = await saveDirtyRows(rows, edits.dirty, saveOne, flash);
    edits.reset(failed);
    setSaving(false);
    load();
    loadHistory();
  };
  const undo = () => {
    edits.reset();
    api.employeesAll().then(list => setRows(list as EmployeeRow[]));
  };
  const manageLogin = async (p: EmployeeRow, action: "create" | "reset") => {
    const password = randomTempPassword();
    setLoginDlg({ p, action, busy: true });
    try {
      // NOTE(recovery): email sendes som den er (kan i teorien være null ved "reset"), som i originalen.
      await api.manageLogin(action, p.email as string, password);
      setLoginDlg({ p, action, password });
      load();
    } catch (w) {
      setLoginDlg(null);
      flash("❌ " + (w as Error).message);
    }
  };
  const copyPassword = (pw: string) =>
    navigator.clipboard?.writeText(pw).then(() => flash("✓ Password kopieret"), () => flash("⚠️ Kunne ikke kopiere — skriv det af"));
  const loginDialog = loginDlg && <div className="modal-backdrop" onClick={() => !loginDlg.busy && setLoginDlg(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-titel" onClick={e => e.stopPropagation()} onKeyDown={e => e.key === "Escape" && !loginDlg.busy && setLoginDlg(null)}><h3 id="login-titel">{loginDlg.action === "create" ? "Opret login" : "Nulstil password"} · {loginDlg.p.name}</h3>{loginDlg.password ? <><p className="small">{loginDlg.action === "create" ? "Login er oprettet" : "Password er nulstillet"} for <b>{loginDlg.p.email}</b>. Midlertidigt password:</p><p className="ok pwinfo" style={{ fontSize: "1.2em", userSelect: "all" }}>🔑 {loginDlg.password}</p><p className="muted small">Skriv det ned eller kopiér det, det vises kun her. Medarbejderen skal vælge sit eget password ved første login.</p><div className="modal-actions"><button className="ghost" onClick={() => copyPassword(loginDlg.password!)}>📋 Kopiér</button><button className="primary" autoFocus onClick={() => setLoginDlg(null)}>Luk</button></div></> : <><p className="small">{loginDlg.action === "create" ? `Opret login til ${loginDlg.p.email}? Der laves et midlertidigt password, som vises her bagefter.` : `Nulstil password for ${loginDlg.p.email}? Det nuværende password holder op med at virke, og der laves et midlertidigt, som vises her bagefter.`}</p><div className="modal-actions"><button className="ghost" disabled={loginDlg.busy} onClick={() => setLoginDlg(null)}>Annullér</button><button className="primary" autoFocus disabled={loginDlg.busy} onClick={() => manageLogin(loginDlg.p, loginDlg.action)}>{loginDlg.busy ? "Arbejder…" : loginDlg.action === "create" ? "Opret login" : "Nulstil password"}</button></div></>}</div></div>;
  return <div>{loginDialog}<div className="row"><label>Ansat i <select value={employerFilter} onChange={g => setEmployerFilter(g.target.value)}><option value="">Alle selskaber</option><option value="none">Ikke angivet</option>{companies.filter(c => c.kind === "selskab").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Sortér efter <select value={sortKey} onChange={g => setSortKey(g.target.value as SortKey)}><option value="name">Navn</option><option value="employer">Ansat i</option><option value="department">Afdeling</option></select></label><span className="muted small" style={{ alignSelf: "flex-end", paddingBottom: 10 }}>{shown.length} af {rows.length} medarbejdere</span></div><div className="tablewrap"><table className="datatable admin"><thead><tr><th>Navn</th><th>Mail</th><th>Afdeling</th><th title="Selskabet medarbejderen er ansat i">Ansat i</th><th className="num">Timepris</th><th>Startdato</th><th className="num">Lønnr.</th><th className="num" title="Flex-saldo ved start (timer, kan være negativ)">Start saldo</th><th className="num" title="Normtid pr. uge — sæt ned ved deltid. Fordeles automatisk man–fre. En ændring gælder fra den valgte lønperiode og frem">Norm/uge</th><th className="num" title="Timer tilskrevet ÅTD saldo i år (fx afspadsering for vagttelefon), pr. lønperiode">Timer tilskrives</th><th>Admin</th><th>Leder</th><th title="Kan leder-godkende medarbejdere i alle afdelinger">Godkender alle</th><th>Aktiv</th><th>Login</th></tr></thead><tbody>{shown.map(p => <tr className={p.active ? "" : "inaktiv"} key={p.id}><td><input value={p.name} onChange={g => patch(p.id, {
                name: g.target.value
              })} /></td><td><input value={p.email || ""} onChange={g => patch(p.id, {
                email: g.target.value
              })} /></td><td><select value={p.department || ""} onChange={g => patch(p.id, {
                department: g.target.value
              })}><option value="">—</option>{DEPARTMENTS.map(g => <option key={g}>{g}</option>)}</select></td><td><select value={p.employer_company_id ?? ""} onChange={g => patch(p.id, {
                employer_company_id: g.target.value ? Number(g.target.value) : null
              })}><option value="">—</option>{employerOptions(p.employer_company_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td><td>{isSimpleDepartment(p.department) ? <input className="hours" value="" disabled title={NO_RATE_TITLE} /> : <input className="hours" value={String(p.hourly_rate).replace(".", ",")} onChange={g => patch(p.id, {
                hourly_rate: g.target.value
              })} />}</td><td><input type="date" title="Dage før startdatoen tæller ikke som manglende" value={p.hired_date || ""} onChange={g => patch(p.id, {
                hired_date: g.target.value
              })} /></td><td><input className="hours" inputMode="numeric" title="Medarbejdernummer i lønsystemet (Lessor)" placeholder="fx 10012" value={p.payroll_number ?? ""} onChange={g => patch(p.id, {
                payroll_number: g.target.value
              })} /></td><td><input className="hours" title="Flex-saldo ved start (timer)" value={String(p.flex_start ?? 0).replace(".", ",")} onChange={g => patch(p.id, {
                flex_start: g.target.value
              })} /></td><td><input className="hours" title={"Dagsfordeling: " + (Array.isArray(p.weekly_norm) ? (p.weekly_norm as unknown[]).slice(0, 5).map(g => String(g).replace(".", ",")).join(" / ") : "") + historyText(p.id)} value={p.norm_uge ?? String(sumNorm(p.weekly_norm)).replace(".", ",")} onChange={g => patch(p.id, {
                norm_uge: g.target.value
              })} />{normChanged(p) ? <label className="small">fra <select title="Lønperioden den nye normtid gælder fra. Tidligere perioder beholder den gamle normtid" value={p.norm_fra || currentPeriod?.start_date || ""} onChange={g => patch(p.id, {
                norm_fra: g.target.value
              })}>{fromOptions.map(x => <option key={x.id} value={x.start_date}>{x.month_name} {x.year} ({fmtDate(x.start_date)})</option>)}</select></label> : upcoming(p.id) ? <div className="muted small" title={historyText(p.id).trim()}>fra {periodName(upcoming(p.id)!.valid_from)}</div> : null}</td><td className="num"><button className="ghost" title="Vis og tilskriv timer pr. lønperiode" onClick={() => setCreditEmp(creditEmp === p.id ? null : p.id)}>{yearCredits(p.id) ? fmtNum(yearCredits(p.id)) + " t" : "＋"}</button></td><td><input type="checkbox" checked={p.is_admin} onChange={g => patch(p.id, {
                is_admin: g.target.checked
              })} /></td><td><input type="checkbox" checked={p.is_manager} onChange={g => patch(p.id, {
                is_manager: g.target.checked
              })} /></td><td><input type="checkbox" title="Kan leder-godkende medarbejdere i alle afdelinger" checked={!!p.approves_all_departments} onChange={g => patch(p.id, {
                approves_all_departments: g.target.checked
              })} /></td><td><input type="checkbox" checked={p.active} onChange={g => patch(p.id, {
                active: g.target.checked
              })} /></td><td>{p.auth_user_id ? <button className="ghost" onClick={() => setLoginDlg({ p, action: "reset" })}>Nulstil pw</button> : p.email ? <button className="ghost" onClick={() => setLoginDlg({ p, action: "create" })}>Opret login</button> : <span className="muted">mangler mail</span>}</td></tr>)}</tbody></table></div><SaveAllBar count={edits.dirty.size} saving={saving} onSave={saveAll} onUndo={undo} />{creditEmp != null && <TilskrevneTimer key={creditEmp} empId={creditEmp} empName={rows.find(r => r.id === creditEmp)?.name || ""} periods={periods} credits={credits.filter(c => c.employee_id === creditEmp)} flash={flash} onChanged={loadCredits} onClose={() => setCreditEmp(null)} />}{draft ? <div className="nyrow"><input placeholder="Navn" value={draft.name} onChange={p => setDraft({
        ...draft,
        name: p.target.value
      })} /><input placeholder="mail@topas.dk" value={draft.email} onChange={p => setDraft({
        ...draft,
        email: p.target.value
      })} /><select value={draft.department} onChange={p => setDraft({
        ...draft,
        department: p.target.value
      })}>{DEPARTMENTS.map(p => <option key={p}>{p}</option>)}</select><select title="Ansat i selskab" value={draft.employer} onChange={p => setDraft({
        ...draft,
        employer: p.target.value
      })}><option value="">Ansat i —</option>{employerOptions(null).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{isSimpleDepartment(draft.department) ? <input className="hours" placeholder="Timepris" value="" disabled title={NO_RATE_TITLE} /> : <input className="hours" placeholder="Timepris" value={draft.rate} onChange={p => setDraft({
        ...draft,
        rate: p.target.value
      })} />}<input type="date" title="Startdato" value={draft.hired} onChange={p => setDraft({
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
            employer_company_id: draft.employer ? Number(draft.employer) : null,
            hourly_rate: isSimpleDepartment(draft.department) ? 0 : parseNum(draft.rate) ?? 0,
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
      employer: employerFilter && employerFilter !== "none" ? employerFilter : "",
      rate: "500",
      norm: "37",
      nr: "",
      saldo: "0",
      admin: false,
      leder: false,
      hired: new Date().toISOString().slice(0, 10)
    })}>➕ Ny medarbejder</button>}<p className="muted small">Norm/uge fordeles automatisk man–fre i kvarter (37 = 7,5/7,5/7,5/7,5/7 t; 30 = 6 t om dagen) — sæt den ned ved deltid. En ændring gælder fra den valgte lønperiode og frem; tidligere perioder beregnes med den gamle normtid (hold musen over feltet for at se historikken). Timer tilskrives = timer der lægges til ÅTD saldo for en lønperiode, fx afspadsering for vagttelefon; de indtastes manuelt (også i Afdelings overblik). Start saldo = flex-saldo ved start. Opret login bagefter i Login-kolonnen.</p></div>;
}
