import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { kontrolSum, type KontrolEntry } from "./saldo";

// ---------------------------------------------------------------------------
// Row types (match the selected column lists). Numeric DB columns are typed as
// number; the code still wraps them in Number() exactly like the original,
// since PostgREST may hand numerics back as strings.
// ---------------------------------------------------------------------------

/** Ugenorm: 7 values, index 0 = mandag .. 6 = søndag. */
export type WeeklyNorm = number[];

export interface EmployeeSelfRow {
  id: number;
  name: string;
  department: string | null;
  weekly_norm: WeeklyNorm;
  is_admin: boolean;
  is_manager: boolean;
  hired_date: string | null;
}

export type SessionEmployee = EmployeeSelfRow & {
  can_economy: boolean;
  must_change: boolean;
  email: string | undefined;
};

export interface Period {
  id: number;
  year: number;
  month_name: string;
  start_date: string;
  end_date: string;
  locked: boolean;
}

export interface CompanyBasic {
  id: number;
  name: string;
}

/** Normuge: typisk mødt/gået/frokost for én ugedag (0 = mandag … 6 = søndag). Ugedage uden række er tomme. */
export interface NormDay {
  weekday: number;
  time_in: string;
  time_out: string;
  lunch_min: number;
}

export interface DefaultAllocation {
  company_id: number;
  share: number;
}

export interface Boot {
  companies: CompanyBasic[];
  task_options: string[];
  period: Period | null;
  defaults: DefaultAllocation[];
  andet_valg: string[];
  today: string;
  weekly_norm: WeeklyNorm;
  employee: SessionEmployee;
}

export interface DayEntrySummary {
  work_date: string;
  location: string | null;
  absence_type: string | null;
  work_hours: number | null;
  absence_hours: number | null;
}

export interface AllocSum {
  work_date: string;
  h: number;
}

export interface DayEntryDetail {
  work_date: string;
  location: string | null;
  location_note: string | null;
  absence_type: string | null;
  absence_note: string | null;
  absence_hours: number | null;
  absence_code: string | null;
  absence_choice: string | null;
  time_in: string | null;
  time_out: string | null;
  work_hours: number | null;
  note: string | null;
}

export interface DayAllocation {
  company_id: number;
  task_type: string;
  hours: number;
  task_note: string | null;
}

export interface SaveDayAllocation {
  company_id: number;
  task_type?: string | null;
  hours: number | null;
  task_note?: string | null;
}

export interface SaveDayInput {
  work_date: string;
  day_type: string;
  location_note?: string | null;
  absence_note?: string | null;
  extra_abs?: string | null;
  absence_code?: string | null;
  absence_choice?: string | null;
  absence_hours?: number | null;
  time_in?: string | null;
  time_out?: string | null;
  work_hours?: number | null;
  note?: string | null;
  allocations?: SaveDayAllocation[];
}

export interface MyPeriodEntry {
  work_date: string;
  location: string | null;
  location_note: string | null;
  absence_type: string | null;
  absence_note: string | null;
  absence_hours: number | null;
  time_in: string | null;
  time_out: string | null;
  work_hours: number | null;
  note: string | null;
}

/** Rows from rpc department_rows. */
export interface DepartmentRpcRow {
  work_date: string;
  emp_name: string;
  company_id: number;
  comp_name: string;
  task_type: string | null;
  task_note: string | null;
  hours: number;
  kr: number | null;
}

/** Rows from rpc department_shared_projects: totals per project × department × month. */
export interface SharedProjectRow {
  company_id: number;
  comp_name: string;
  department: string;
  month: number;
  hours: number;
  kr: number;
}

export interface DepartmentBudget {
  company_id: number;
  period_type: string;
  hours: number;
  comp_name: string;
}

export interface DepartmentPlan {
  company_id: number;
  month: number;
  hours: number;
  comp_name: string;
}

export interface MatrixEmployee {
  id: number;
  name: string;
  department: string | null;
  weekly_norm: WeeklyNorm;
  hired_date: string | null;
}

export interface MatrixEntry {
  employee_id: number;
  work_date: string;
  location: string | null;
  absence_type: string | null;
  work_hours: number | null;
}

export interface MatrixAllocSum {
  employee_id: number;
  work_date: string;
  h: number;
}

interface BillingAllocRow {
  employee_id: number;
  company_id: number;
  hours: number;
  task_type: string | null;
}

interface ProjectAllocRow extends BillingAllocRow {
  work_date: string;
}

interface BillingRuleRow {
  source_company_id: number;
  target_company_id: number;
  share: number;
}

interface BillingCompanyRow {
  id: number;
  name: string;
  kind: string;
  billing_type: string | null;
  expected_settlement: string | null;
}

interface BillingEmployeeRow {
  id: number;
  name: string;
  hourly_rate: number | null;
  department: string | null;
}

export interface HoursKr {
  t: number;
  kr: number;
}

export interface BillRow {
  selskab: string;
  type: "projekt" | "selskab";
  reg_t: number;
  fakt_t: number;
  fakt_kr: number;
}

export interface InvoiceLine {
  emp: string;
  dept: string;
  ty: string;
  kilde: string | null;
  rate: number;
  t: number;
  kr: number;
}

export interface ParkedProject {
  selskab: string;
  expected: string | null;
  t: number;
  kr: number;
}

export interface Distribution {
  target: string;
  share: number;
}

export interface ProjectLine {
  emp: string;
  dept: string;
  ty: string;
  rate: number;
  t: number;
  kr: number;
}

export interface ProjectMonth {
  md: string;
  t: number;
  kr: number;
}

export interface ProjectEconomy {
  comp: string;
  billing: "samlet" | "loebende";
  expected: string | null;
  t: number;
  kr: number;
  fordeling: Distribution[];
  mdr: ProjectMonth[];
  lines: ProjectLine[];
}

export interface BillingCategories {
  drift: HoursKr;
  projektLoebende: HoursKr;
  projektSamlet: HoursKr;
}

export interface EcoBillingResult {
  bill: BillRow[];
  invoice: Record<string, InvoiceLine[]>;
  projekter: ProjectEconomy[];
  parkeret: ParkedProject[];
  kategorier: BillingCategories;
  fordelt: HoursKr;
  total: { reg_t: number; fakt_t: number; fakt_kr: number };
}

export interface DayEntryRow {
  id?: number;
  employee_id: number;
  work_date: string;
  location: string | null;
  location_note: string | null;
  absence_type: string | null;
  absence_note: string | null;
  absence_hours: number | null;
  absence_code: string | null;
  absence_choice: string | null;
  time_in: string | null;
  time_out: string | null;
  work_hours: number | null;
  note: string | null;
  updated_at?: string | null;
}

interface AbsenceEmployeeRow {
  id: number;
  name: string;
  department: string | null;
  weekly_norm: WeeklyNorm | null;
  hired_date: string | null;
  payroll_number: number | null;
}

export type AbsenceEntry = DayEntryRow & {
  emp_name: string;
  department: string;
  weekly_norm: WeeklyNorm;
  hired_date: string | null;
  payroll_number: number | null;
};

export interface AbsenceYtd {
  emp_name: string;
  ferie_ytd: number;
  syg_ytd: number;
}

export interface EmployeeAdminRow {
  id: number;
  name: string;
  email: string | null;
  department: string | null;
  is_admin: boolean;
  is_manager: boolean;
  active: boolean;
  hourly_rate: number | null;
  hired_date: string | null;
  payroll_number: number | null;
  weekly_norm: WeeklyNorm;
  flex_start: number | null;
  auth_user_id: string | null;
}

export type EmployeeInput = Partial<Omit<EmployeeAdminRow, "id" | "auth_user_id">>;

export interface CompanyAdminRow {
  id: number;
  name: string;
  kind: string;
  billing_type: string | null;
  expected_settlement: string | null;
  active: boolean;
  sort: number;
}

export type CompanyInput = Partial<Omit<CompanyAdminRow, "id">>;

export interface ProjectInput {
  name: string;
  billing_type: "loebende" | "samlet";
  expected_settlement: string | null;
  active: boolean;
  sort: number;
}

export interface TaskTypeRow {
  id: number;
  name: string;
  active: boolean;
  sort: number;
}

export type TaskTypeInput = Partial<Omit<TaskTypeRow, "id">> & { department?: string };

export interface BillingRuleAdminRow {
  id: number;
  source_company_id: number;
  target_company_id: number;
  share: number;
  active: boolean;
}

export interface RuleInput {
  target_company_id: number;
  share: number;
}

export interface AccessRow {
  company_id: number;
}

export interface HourBudgetRow {
  id: number;
  company_id: number;
  department: string;
  period_type: string;
  hours: number;
  year: number;
  active: boolean;
}

export type BudgetInput = Omit<HourBudgetRow, "id"> & { id?: number };

export interface PlanRow {
  company_id: number;
  month: number;
  hours: number;
}

export interface AbsenceCodeRow {
  code: string;
  label: string;
  source: string | null;
}

export interface ApprovalRow {
  employee_id: number;
  leader_approved: boolean | null;
  economy_approved: boolean | null;
}

export interface ProxyEmployee {
  id: number;
  name: string;
  weekly_norm: WeeklyNorm;
  hired_date: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

type ErrorLike = { code?: string | number; message?: string } | null | undefined;
type QueryResult = { data: unknown; error: PostgrestError | null };

/** Throws a Danish user-facing error (42501 = RLS/permission denied). */
export function raise(err: ErrorLike, fallback = "Noget gik galt"): never {
  const message =
    err?.code === "42501"
      ? "Databasen afviste ændringen (perioden er låst, eller du har ikke adgang)"
      : err?.message || fallback;
  const error = new Error(message) as Error & { status?: string | number };
  error.status = err?.code;
  throw error;
}

/** Awaits a query, throws on error, returns data ?? []. */
export async function q<T>(query: PromiseLike<QueryResult>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    raise(error);
  }
  return (data ?? []) as T[];
}

const PAGE_SIZE = 1000;

/** Fetches all rows by paging with .range() in blocks of 1000. */
export async function fetchAll<T>(
  build: () => { range(from: number, to: number): PromiseLike<QueryResult> },
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await q<T>(build().range(from, from + PAGE_SIZE - 1));
    all.push(...page);
    if (page.length < PAGE_SIZE) {
      return all;
    }
  }
}

export async function currentEmployee(): Promise<SessionEmployee | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || data == null || !data.user) {
    return null;
  }
  const user = data.user;
  const rows = await q<EmployeeSelfRow>(
    supabase
      .from("employees")
      .select("id, name, department, weekly_norm, is_admin, is_manager, hired_date")
      .eq("auth_user_id", user.id)
      .eq("active", true),
  );
  if (!rows.length) {
    return null;
  }
  const emp = rows[0];
  const meta = user.user_metadata;
  return {
    ...emp,
    can_economy: !!emp.is_admin || (emp.department === "Økonomi" && !!emp.is_manager),
    must_change: meta != null && !!meta.must_change,
    email: user.email,
  };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

type EmpTaskLine = { emp: string; dept: string; ty: string; rate: number; t: number };

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  async login(email: string, password: string): Promise<{ employee: SessionEmployee }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(/invalid login credentials/i.test(error.message) ? "Forkert mail eller password" : error.message);
    }
    const employee = await currentEmployee();
    if (!employee) {
      await supabase.auth.signOut();
      throw new Error("Dit login er ikke koblet til en aktiv medarbejder — kontakt admin");
    }
    return { employee };
  },

  async session(): Promise<SessionEmployee | null> {
    const { data } = await supabase.auth.getSession();
    if (data != null && data.session) {
      return currentEmployee();
    } else {
      return null;
    }
  },

  /**
   * "Glemt password": Supabase mails a reset link back to this app. Errors are swallowed on
   * purpose: the screen always says the mail was sent, so nobody can probe which mails exist.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = window.location.origin + window.location.pathname;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) {
        console.warn("resetPasswordForEmail", error.message);
      }
    } catch (err) {
      console.warn("resetPasswordForEmail", err);
    }
  },

  async changePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password, data: { must_change: false } });
    if (error) {
      raise(error);
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async bootstrap(): Promise<Boot> {
    const me = await currentEmployee();
    if (!me) {
      throw new Error("Ikke logget ind");
    }
    const today = todayIso();
    const [companies, access, taskTypes, periods, defaults, andet] = await Promise.all([
      q<CompanyBasic>(supabase.from("companies").select("id, name").eq("active", true).order("sort").order("name")),
      q<AccessRow>(supabase.from("employee_companies").select("company_id").eq("employee_id", me.id)),
      q<{ name: string }>(
        supabase
          .from("task_types")
          .select("name")
          .eq("active", true)
          .eq("department", me.department || "")
          .order("sort")
          .order("name"),
      ),
      q<Period>(
        supabase
          .from("periods")
          .select("id, year, month_name, start_date, end_date, locked")
          .lte("start_date", today)
          .gte("end_date", today),
      ),
      q<DefaultAllocation>(supabase.from("default_allocations").select("company_id, share").eq("employee_id", me.id)),
      q<{ id: number; label: string }>(supabase.from("andet_fravaer_valg").select("id, label").eq("active", true).order("sort")),
    ]);
    const allowed = new Set(access.map((a) => a.company_id));
    return {
      companies: allowed.size ? companies.filter((c) => allowed.has(c.id)) : companies,
      task_options: taskTypes.map((tt) => tt.name),
      period: periods[0] || null,
      defaults,
      andet_valg: andet.map((a) => a.label),
      today,
      weekly_norm: me.weekly_norm,
      employee: me,
    };
  },

  async periodDays(
    from: string,
    to: string,
    employeeId?: number | null,
  ): Promise<{ entries: DayEntrySummary[]; alloc_sums: AllocSum[] }> {
    const me = await currentEmployee();
    const empId = employeeId || me!.id;
    const [entries, allocs] = await Promise.all([
      q<DayEntrySummary>(
        supabase
          .from("day_entries")
          .select("work_date, location, absence_type, work_hours, absence_hours")
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lte("work_date", to),
      ),
      q<{ work_date: string; hours: number }>(
        supabase
          .from("allocations")
          .select("work_date, hours")
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lte("work_date", to),
      ),
    ]);
    const sums: Record<string, number> = {};
    for (const a of allocs) {
      sums[a.work_date] = (sums[a.work_date] || 0) + Number(a.hours);
    }
    return {
      entries,
      alloc_sums: Object.entries(sums).map(([work_date, h]) => ({ work_date, h })),
    };
  },

  async day(
    date: string,
    employeeId?: number | null,
  ): Promise<{ entry: DayEntryDetail | null; allocations: DayAllocation[] }> {
    const me = await currentEmployee();
    const empId = employeeId || me!.id;
    const [entries, allocations] = await Promise.all([
      q<DayEntryDetail>(
        supabase
          .from("day_entries")
          .select(
            "work_date, location, location_note, absence_type, absence_note, absence_hours, absence_code, absence_choice, time_in, time_out, work_hours, note",
          )
          .eq("employee_id", empId)
          .eq("work_date", date),
      ),
      q<DayAllocation>(
        supabase
          .from("allocations")
          .select("company_id, task_type, hours, task_note")
          .eq("employee_id", empId)
          .eq("work_date", date)
          .order("id"),
      ),
    ]);
    return { entry: entries[0] || null, allocations };
  },

  async saveDay(input: SaveDayInput, employeeId?: number | null): Promise<{ ok: true; deleted?: true }> {
    const me = await currentEmployee();
    const target = { id: employeeId || me!.id };
    const date = input.work_date;
    const locked = await q<{ id: number }>(
      supabase.from("periods").select("id").lte("start_date", date).gte("end_date", date).eq("locked", true),
    );
    if (locked.length) {
      throw new Error("Perioden er låst af økonomi");
    }
    if (input.day_type === "Ingen") {
      await q(supabase.from("allocations").delete().eq("employee_id", target.id).eq("work_date", date).select("id"));
      await q(supabase.from("day_entries").delete().eq("employee_id", target.id).eq("work_date", date).select("id"));
      await q(
        supabase.from("form_drafts").delete().eq("employee_id", target.id).eq("work_date", date).select("employee_id"),
      );
      return { ok: true, deleted: true };
    }
    const isWork = ["Kontor", "Andet sted", "Rejsedag"].includes(input.day_type);
    const absenceType = ["Ferie", "Egen sygdom", "Barn syg", "Øvrigt fravær"].includes(input.day_type)
      ? input.day_type
      : (isWork && input.extra_abs) || null;
    const { error } = await supabase.from("day_entries").upsert(
      {
        employee_id: target.id,
        work_date: date,
        location: isWork ? input.day_type : null,
        location_note: ["Andet sted", "Rejsedag"].includes(input.day_type) ? input.location_note : null,
        absence_type: absenceType,
        absence_note: input.absence_note,
        absence_hours: input.absence_hours,
        absence_code: (absenceType && input.absence_code) || null,
        absence_choice: (absenceType && input.absence_choice) || null,
        time_in: isWork ? input.time_in : null,
        time_out: isWork ? input.time_out : null,
        work_hours: isWork ? input.work_hours : null,
        note: input.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id,work_date" },
    );
    if (error) {
      raise(error);
    }
    await q(supabase.from("allocations").delete().eq("employee_id", target.id).eq("work_date", date).select("id"));
    const rows = (input.allocations || [])
      .filter((a) => a.hours && a.hours > 0)
      .map((a) => ({
        employee_id: target.id,
        work_date: date,
        company_id: a.company_id,
        task_type: a.task_type || "",
        hours: a.hours,
        task_note: a.task_note,
      }));
    if (rows.length) {
      const { error: insertError } = await supabase.from("allocations").insert(rows);
      if (insertError) {
        raise(insertError);
      }
    }
    await q(
      supabase.from("form_drafts").delete().eq("employee_id", target.id).eq("work_date", date).select("employee_id"),
    );
    return { ok: true };
  },

  periods: (): Promise<Period[]> =>
    q<Period>(supabase.from("periods").select("id, year, month_name, start_date, end_date, locked").order("start_date")),

  async myPeriod(
    from: string,
    to: string,
    employeeId?: number | null,
  ): Promise<{ entries: MyPeriodEntry[]; day_alloc: Record<string, number>; comp_sums: { comp: string; h: number }[] }> {
    const me = await currentEmployee();
    const empId = employeeId || me!.id;
    const [entries, allocs, companies] = await Promise.all([
      q<MyPeriodEntry>(
        supabase
          .from("day_entries")
          .select(
            "work_date, location, location_note, absence_type, absence_note, absence_hours, time_in, time_out, work_hours, note",
          )
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lte("work_date", to)
          .order("work_date"),
      ),
      q<{ company_id: number; hours: number; work_date: string }>(
        supabase
          .from("allocations")
          .select("company_id, hours, work_date")
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lte("work_date", to),
      ),
      q<CompanyBasic>(supabase.from("companies").select("id, name")),
    ]);
    const nameById: Record<string, string> = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    const perComp: Record<string, number> = {};
    const perDay: Record<string, number> = {};
    for (const a of allocs) {
      const comp = nameById[a.company_id] || `#${a.company_id}`;
      perComp[comp] = (perComp[comp] || 0) + Number(a.hours);
      perDay[a.work_date] = (perDay[a.work_date] || 0) + Number(a.hours);
    }
    return {
      entries,
      day_alloc: perDay,
      comp_sums: Object.entries(perComp)
        .sort((a, b) => b[1] - a[1])
        .map(([comp, h]) => ({ comp, h })),
    };
  },

  async department(
    year: number,
    dept?: string | null,
  ): Promise<{ dept: string; rows: DepartmentRpcRow[]; budgets: DepartmentBudget[]; plan: DepartmentPlan[] }> {
    const me = await currentEmployee();
    const department = (me!.can_economy && dept) || me!.department;
    if (!department) {
      throw new Error("Ingen afdeling");
    }
    const [rows, budgets, plan, companies] = await Promise.all([
      q<DepartmentRpcRow>(supabase.rpc("department_rows", { p_year: year, p_dept: department })),
      q<Omit<DepartmentBudget, "comp_name">>(
        supabase
          .from("hour_budgets")
          .select("company_id, period_type, hours")
          .eq("active", true)
          .eq("department", department)
          .eq("year", year),
      ),
      q<PlanRow>(supabase.from("budget_plan").select("company_id, month, hours").eq("department", department).eq("year", year)),
      q<CompanyBasic>(supabase.from("companies").select("id, name")),
    ]);
    const nameById: Record<string, string> = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    return {
      dept: department,
      rows: rows.map((r) => ({ ...r, work_date: String(r.work_date) })),
      budgets: budgets.map((b) => ({ ...b, comp_name: nameById[b.company_id] || "" })),
      plan: plan.map((p) => ({ ...p, comp_name: nameById[p.company_id] || "" })),
    };
  },

  /** Projekter afdelingen har timer på, med alle afdelingers timer + kr (kun totaler). */
  async departmentShared(year: number, dept?: string | null): Promise<SharedProjectRow[]> {
    const me = await currentEmployee();
    const department = (me!.can_economy && dept) || me!.department;
    if (!department) {
      return [];
    }
    const rows = await q<SharedProjectRow>(
      supabase.rpc("department_shared_projects", { p_year: year, p_dept: department }),
    );
    return rows.map((r) => ({ ...r, month: Number(r.month), hours: Number(r.hours), kr: Number(r.kr) }));
  },

  async ecoMatrix(
    from: string,
    to: string,
  ): Promise<{ employees: MatrixEmployee[]; entries: MatrixEntry[]; alloc_sums: MatrixAllocSum[]; today: string }> {
    const [employees, entries, allocs] = await Promise.all([
      q<MatrixEmployee>(
        supabase.from("employees").select("id, name, department, weekly_norm, hired_date").eq("active", true).order("name"),
      ),
      q<MatrixEntry>(
        supabase
          .from("day_entries")
          .select("employee_id, work_date, location, absence_type, work_hours")
          .gte("work_date", from)
          .lte("work_date", to),
      ),
      q<{ employee_id: number; work_date: string; hours: number }>(
        supabase.from("allocations").select("employee_id, work_date, hours").gte("work_date", from).lte("work_date", to),
      ),
    ]);
    const sums: Record<string, number> = {};
    for (const a of allocs) {
      const key = `${a.employee_id}|${a.work_date}`;
      sums[key] = (sums[key] || 0) + Number(a.hours);
    }
    return {
      employees,
      entries,
      alloc_sums: Object.entries(sums).map(([key, h]) => {
        const [empId, workDate] = key.split("|");
        return { employee_id: Number(empId), work_date: workDate, h };
      }),
      today: todayIso(),
    };
  },

  /*
   * Fakturering / rebilling for perioden [from, to].
   * 1. Kategorier: alle registrerede timer (og kr = timer * timesats) opdeles i
   *    drift (selskaber), projekt løbende og projekt samlet (billing_type "samlet").
   * 2. Registreret pr. selskab (ekskl. "samlet"-projekter, som parkeres til afslutning),
   *    plus linjer pr. medarbejder|opgavetype pr. selskab.
   * 3. Fordeling via billing_rules: en kildes timer/kr flyttes med share til målselskaber;
   *    kilden fratrækkes det fordelte. Fordelt fra projekter summeres i "fordelt".
   * 4. bill: registreret vs. faktureret pr. selskab/projekt.
   * 5. parkeret: "samlet"-projekter med timer i perioden.
   * 6. invoice: fakturalinjer pr. målselskab (fordelte linjer har kilde = kildeselskab,
   *    restandel bliver hos kilden).
   * 7. projekter: projektøkonomi siden start (alle allocations på projekter, ingen datofilter),
   *    med månedsfordeling og linjer.
   * EN: same steps; arithmetic, rounding and ordering are identical to the original build.
   */
  async ecoBilling(from: string, to: string): Promise<EcoBillingResult> {
    const [allocs, rules, companies, employees] = await Promise.all([
      fetchAll<BillingAllocRow>(() =>
        supabase
          .from("allocations")
          .select("employee_id, company_id, hours, task_type")
          .gte("work_date", from)
          .lte("work_date", to)
          .order("id"),
      ),
      q<BillingRuleRow>(supabase.from("billing_rules").select("source_company_id, target_company_id, share").eq("active", true)),
      q<BillingCompanyRow>(supabase.from("companies").select("id, name, kind, billing_type, expected_settlement")),
      q<BillingEmployeeRow>(supabase.from("employees").select("id, name, hourly_rate, department")),
    ]);
    const companyById: Record<string, BillingCompanyRow> = Object.fromEntries(companies.map((c) => [c.id, c]));
    const employeeById: Record<string, BillingEmployeeRow> = Object.fromEntries(employees.map((e) => [e.id, e]));
    const samletIds = new Set(companies.filter((c) => c.kind === "projekt" && c.billing_type === "samlet").map((c) => c.id));
    const billable = allocs.filter((a) => !samletIds.has(a.company_id));

    // 1. Kategorier
    const categories: BillingCategories = {
      drift: { t: 0, kr: 0 },
      projektLoebende: { t: 0, kr: 0 },
      projektSamlet: { t: 0, kr: 0 },
    };
    for (const a of allocs) {
      const company = companyById[a.company_id];
      const emp: Partial<BillingEmployeeRow> = employeeById[a.employee_id] || {};
      const hours = Number(a.hours);
      const kr = hours * Number(emp.hourly_rate || 0);
      const bucket = samletIds.has(a.company_id)
        ? categories.projektSamlet
        : company?.kind === "projekt"
          ? categories.projektLoebende
          : categories.drift;
      bucket.t += hours;
      bucket.kr += kr;
    }
    for (const c of Object.values(categories)) {
      c.t = round2(c.t);
      c.kr = Math.round(c.kr);
    }

    // 2. Registreret pr. selskab + linjer pr. selskab
    const regHours: Record<string, number> = {};
    const regKr: Record<string, number> = {};
    const linesByCompany: Record<string, Record<string, EmpTaskLine>> = {};
    for (const a of billable) {
      const company = companyById[a.company_id];
      const compName = company?.name || `#${a.company_id}`;
      const emp: Partial<BillingEmployeeRow> = employeeById[a.employee_id] || {};
      const hours = Number(a.hours);
      const rate = Number(emp.hourly_rate || 0);
      regHours[compName] = (regHours[compName] || 0) + hours;
      regKr[compName] = (regKr[compName] || 0) + hours * rate;
      const lines = (linesByCompany[a.company_id] = linesByCompany[a.company_id] || {});
      const key = `${emp.name || "?"}|${a.task_type || ""}`;
      const line = (lines[key] = lines[key] || {
        emp: emp.name || "?",
        dept: emp.department || "",
        ty: a.task_type || "",
        rate,
        t: 0,
      });
      line.t += hours;
    }

    // 3. Fordelingsregler pr. kildenavn
    const rulesBySource: Record<string, Distribution[]> = {};
    for (const r of rules) {
      const sourceName = companyById[r.source_company_id]?.name;
      const targetName = companyById[r.target_company_id]?.name;
      if (!!sourceName && !!targetName) {
        (rulesBySource[sourceName] = rulesBySource[sourceName] || []).push({
          target: targetName,
          share: Number(r.share),
        });
      }
    }
    const kindByName: Record<string, string> = Object.fromEntries(companies.map((c) => [c.name, c.kind]));
    const billedHours: Record<string, number> = { ...regHours };
    const billedKr: Record<string, number> = { ...regKr };
    const distributed: HoursKr = { t: 0, kr: 0 };
    for (const [source, dists] of Object.entries(rulesBySource)) {
      const srcHours = regHours[source] || 0;
      const srcKr = regKr[source] || 0;
      if (srcHours <= 0) {
        continue;
      }
      let movedHours = 0;
      let movedKr = 0;
      for (const d of dists) {
        billedHours[d.target] = (billedHours[d.target] || 0) + srcHours * d.share;
        billedKr[d.target] = (billedKr[d.target] || 0) + srcKr * d.share;
        movedHours += srcHours * d.share;
        movedKr += srcKr * d.share;
      }
      billedHours[source] = (billedHours[source] || 0) - movedHours;
      billedKr[source] = (billedKr[source] || 0) - movedKr;
      if (kindByName[source] === "projekt") {
        distributed.t += movedHours;
        distributed.kr += movedKr;
      }
    }

    // 4. Registreret vs. faktureret
    const bill: BillRow[] = [...new Set([...Object.keys(regHours), ...Object.keys(billedHours)])]
      .sort()
      .map(
        (name): BillRow => ({
          selskab: name,
          type: kindByName[name] === "projekt" ? "projekt" : "selskab",
          reg_t: round2(regHours[name] || 0),
          fakt_t: round2(billedHours[name] || 0),
          fakt_kr: Math.round(billedKr[name] || 0),
        }),
      )
      .filter((b) => (b.type === "selskab" && Math.abs(b.reg_t) > 0.005) || Math.abs(b.fakt_t) > 0.005);

    // 5. Parkerede "samlet"-projekter
    const parkedById: Record<string, HoursKr> = {};
    for (const a of allocs) {
      if (!samletIds.has(a.company_id)) {
        continue;
      }
      const emp: Partial<BillingEmployeeRow> = employeeById[a.employee_id] || {};
      const hours = Number(a.hours);
      const acc = (parkedById[a.company_id] = parkedById[a.company_id] || { t: 0, kr: 0 });
      acc.t += hours;
      acc.kr += hours * Number(emp.hourly_rate || 0);
    }
    const parked: ParkedProject[] = Object.entries(parkedById)
      .map(([id, acc]) => ({
        selskab: companyById[id].name,
        expected: companyById[id].expected_settlement || null,
        t: round2(acc.t),
        kr: Math.round(acc.kr),
      }))
      .filter((p) => p.t > 0.005)
      .sort((a, b) => a.selskab.localeCompare(b.selskab));

    // 6. Fakturalinjer pr. målselskab
    const invoice: Record<string, InvoiceLine[]> = {};
    const addLine = (target: string, line: InvoiceLine) => (invoice[target] = invoice[target] || []).push(line);
    for (const [companyId, lines] of Object.entries(linesByCompany)) {
      const compName = companyById[companyId]?.name || `#${companyId}`;
      const dists = rulesBySource[compName];
      const rest = dists ? 1 - dists.reduce((sum, d) => sum + d.share, 0) : 0;
      for (const line of Object.values(lines)) {
        if (dists) {
          for (const d of dists) {
            addLine(d.target, {
              emp: line.emp,
              dept: line.dept,
              ty: line.ty,
              kilde: compName,
              rate: line.rate,
              t: round2(line.t * d.share),
              kr: Math.round(line.t * d.share * line.rate),
            });
          }
          if (rest > 0.005) {
            addLine(compName, {
              emp: line.emp,
              dept: line.dept,
              ty: line.ty,
              kilde: null,
              rate: line.rate,
              t: round2(line.t * rest),
              kr: Math.round(line.t * rest * line.rate),
            });
          }
        } else {
          addLine(compName, {
            emp: line.emp,
            dept: line.dept,
            ty: line.ty,
            kilde: null,
            rate: line.rate,
            t: round2(line.t),
            kr: Math.round(line.t * line.rate),
          });
        }
      }
    }
    for (const lines of Object.values(invoice)) {
      lines.sort(
        (a, b) =>
          a.dept.localeCompare(b.dept) ||
          a.emp.localeCompare(b.emp) ||
          a.ty.localeCompare(b.ty) ||
          (a.kilde || "").localeCompare(b.kilde || ""),
      );
    }

    // 7. Projektøkonomi siden start
    const projectIds = companies.filter((c) => c.kind === "projekt").map((c) => c.id);
    let projects: ProjectEconomy[] = [];
    if (projectIds.length) {
      const projectAllocs = await fetchAll<ProjectAllocRow>(() =>
        supabase
          .from("allocations")
          .select("employee_id, company_id, hours, task_type, work_date")
          .in("company_id", projectIds)
          .order("id"),
      );
      type ProjectAcc = { t: number; kr: number; lines: Record<string, EmpTaskLine>; mdr: Record<string, HoursKr> };
      const byProject: Record<string, ProjectAcc> = {};
      for (const a of projectAllocs) {
        const emp: Partial<BillingEmployeeRow> = employeeById[a.employee_id] || {};
        const rate = Number(emp.hourly_rate || 0);
        const hours = Number(a.hours);
        const acc = (byProject[a.company_id] = byProject[a.company_id] || { t: 0, kr: 0, lines: {}, mdr: {} });
        acc.t += hours;
        acc.kr += hours * rate;
        const key = `${emp.name || "?"}|${a.task_type || ""}`;
        const line = (acc.lines[key] = acc.lines[key] || {
          emp: emp.name || "?",
          dept: emp.department || "",
          ty: a.task_type || "",
          rate,
          t: 0,
        });
        line.t += hours;
        const month = a.work_date.slice(0, 7);
        const m = (acc.mdr[month] = acc.mdr[month] || { t: 0, kr: 0 });
        m.t += hours;
        m.kr += hours * rate;
      }
      projects = projectIds
        .map((id): ProjectEconomy => {
          const acc = byProject[id] || { t: 0, kr: 0, lines: {}, mdr: {} };
          const fordeling = (rulesBySource[companyById[id].name] || []).map((d) => ({
            target: d.target,
            share: d.share,
          }));
          return {
            comp: companyById[id].name,
            billing: samletIds.has(id) ? "samlet" : "loebende",
            expected: companyById[id].expected_settlement || null,
            t: round2(acc.t),
            kr: Math.round(acc.kr),
            fordeling,
            mdr: Object.entries(acc.mdr)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([md, m]) => ({ md, t: round2(m.t), kr: Math.round(m.kr) })),
            lines: Object.values(acc.lines)
              .map((l) => ({ ...l, t: round2(l.t), kr: Math.round(l.t * l.rate) }))
              .sort((a, b) => a.dept.localeCompare(b.dept) || a.emp.localeCompare(b.emp) || a.ty.localeCompare(b.ty)),
          };
        })
        .sort((a, b) => a.comp.localeCompare(b.comp));
    }

    const sumValues = (obj: Record<string, number>) => Object.values(obj).reduce((s, v) => s + v, 0);
    return {
      bill,
      invoice,
      projekter: projects,
      parkeret: parked,
      kategorier: categories,
      fordelt: { t: round2(distributed.t), kr: Math.round(distributed.kr) },
      total: {
        reg_t: round2(bill.reduce((s, b) => s + b.reg_t, 0)),
        fakt_t: round2(sumValues(billedHours)),
        // NOTE(recovery): fakt_kr sums the registered kr (regKr), not billedKr; kept as in the original.
        fakt_kr: Math.round(sumValues(regKr)),
      },
    };
  },

  async ecoAbsence(
    from: string,
    to: string,
  ): Promise<{ entries: AbsenceEntry[]; ytd: AbsenceYtd[]; ferieaar_start: string }> {
    const year = Number(to.slice(0, 4));
    // Ferieår starter 1. september
    const holidayYearStart = Number(to.slice(5, 7)) >= 9 ? `${year}-09-01` : `${year - 1}-09-01`;
    const [entries, employees, ytdRows] = await Promise.all([
      q<DayEntryRow>(supabase.from("day_entries").select("*").gte("work_date", from).lte("work_date", to).order("work_date")),
      q<AbsenceEmployeeRow>(supabase.from("employees").select("id, name, department, weekly_norm, hired_date, payroll_number")),
      q<{ employee_id: number; absence_type: string | null; absence_hours: number | null }>(
        supabase
          .from("day_entries")
          .select("employee_id, absence_type, absence_hours")
          .gte("work_date", holidayYearStart)
          .lte("work_date", to)
          .not("absence_type", "is", null),
      ),
    ]);
    const empById: Record<string, AbsenceEmployeeRow> = Object.fromEntries(employees.map((e) => [e.id, e]));
    const withEmp: AbsenceEntry[] = entries
      .map((e) => ({
        ...e,
        emp_name: empById[e.employee_id]?.name || `#${e.employee_id}`,
        department: empById[e.employee_id]?.department || "",
        // NOTE(recovery): fallback is {} (not []) as in the original.
        weekly_norm: (empById[e.employee_id]?.weekly_norm || {}) as WeeklyNorm,
        hired_date: empById[e.employee_id]?.hired_date || null,
        payroll_number: empById[e.employee_id]?.payroll_number ?? null,
      }))
      .sort((a, b) => a.emp_name.localeCompare(b.emp_name) || a.work_date.localeCompare(b.work_date));
    const ytd: Record<string, AbsenceYtd> = {};
    for (const r of ytdRows) {
      const name = empById[r.employee_id]?.name || `#${r.employee_id}`;
      const acc = (ytd[name] = ytd[name] || { emp_name: name, ferie_ytd: 0, syg_ytd: 0 });
      if (r.absence_type === "Ferie") {
        acc.ferie_ytd += 1;
      }
      if (r.absence_type === "Egen sygdom") {
        acc.syg_ytd += Number(r.absence_hours || 0);
      }
    }
    return { entries: withEmp, ytd: Object.values(ytd), ferieaar_start: holidayYearStart };
  },

  async saveDefaults(defaults: DefaultAllocation[]): Promise<void> {
    const me = await currentEmployee();
    await q(supabase.from("default_allocations").delete().eq("employee_id", me!.id).select("employee_id"));
    if (defaults.length) {
      const { error } = await supabase.from("default_allocations").insert(
        defaults.map((d) => ({ employee_id: me!.id, company_id: d.company_id, share: d.share })),
      );
      if (error) {
        raise(error);
      }
    }
  },

  async setPeriodLock(periodId: number, locked: boolean): Promise<void> {
    const { error } = await supabase.from("periods").update({ locked }).eq("id", periodId);
    if (error) {
      raise(error);
    }
  },

  employeesAll: (): Promise<EmployeeAdminRow[]> =>
    q<EmployeeAdminRow>(
      supabase
        .from("employees")
        .select(
          "id, name, email, department, is_admin, is_manager, active, hourly_rate, hired_date, payroll_number, weekly_norm, flex_start, auth_user_id",
        )
        .order("name"),
    ),

  async saveEmployee(id: number | null | undefined, data: EmployeeInput): Promise<void> {
    const query = id ? supabase.from("employees").update(data).eq("id", id) : supabase.from("employees").insert(data);
    const { error } = await query;
    if (error) {
      raise(error);
    }
  },

  companiesAll: (): Promise<CompanyAdminRow[]> =>
    q<CompanyAdminRow>(
      supabase
        .from("companies")
        .select("id, name, kind, billing_type, expected_settlement, active, sort")
        .order("sort")
        .order("name"),
    ),

  async saveCompany(id: number | null | undefined, data: CompanyInput): Promise<void> {
    const query = id ? supabase.from("companies").update(data).eq("id", id) : supabase.from("companies").insert(data);
    const { error } = await query;
    if (error) {
      raise(error);
    }
  },

  /**
   * Opretter/retter et projekt via RPC'en `save_project` (returnerer id).
   * `rules` = null lader fordelingsnøglerne være; ellers erstattes de i samme transaktion.
   * Databasen afviser et løbende projekt uden fordelingsnøgler.
   */
  async saveProject(id: number | null | undefined, data: ProjectInput, rules: RuleInput[] | null): Promise<number> {
    const { data: newId, error } = await supabase.rpc("save_project", {
      p_id: id ?? null,
      p_name: data.name,
      p_billing_type: data.billing_type,
      p_expected_settlement: data.billing_type === "samlet" ? data.expected_settlement || null : null,
      p_active: data.active,
      p_sort: data.sort,
      p_rules: rules && rules.map((r) => ({ target_company_id: r.target_company_id, share: r.share })),
    });
    if (error) {
      raise(error);
    }
    return newId as number;
  },

  taskTypesFor: (department: string): Promise<TaskTypeRow[]> =>
    q<TaskTypeRow>(
      supabase.from("task_types").select("id, name, active, sort").eq("department", department).order("sort").order("name"),
    ),

  /** Ændring går via RPC'en `save_task_type`, så et nyt navn også følger med på eksisterende timelinjer. */
  async saveTaskType(id: number | null | undefined, data: TaskTypeInput): Promise<void> {
    const { error } = id
      ? await supabase.rpc("save_task_type", { p_id: id, p_name: data.name ?? "", p_sort: data.sort ?? 0, p_active: data.active ?? true })
      : await supabase.from("task_types").insert(data);
    if (error) {
      raise(error);
    }
  },

  rulesAll: (): Promise<BillingRuleAdminRow[]> =>
    q<BillingRuleAdminRow>(supabase.from("billing_rules").select("id, source_company_id, target_company_id, share, active")),

  async saveRulesForSource(sourceCompanyId: number, rules: RuleInput[]): Promise<void> {
    const { error } = await supabase.rpc("save_billing_rules", {
      p_source_company_id: sourceCompanyId,
      p_rules: rules.map((r) => ({ target_company_id: r.target_company_id, share: r.share })),
    });
    if (error) {
      raise(error);
    }
  },

  accessFor: (employeeId: number): Promise<AccessRow[]> =>
    q<AccessRow>(supabase.from("employee_companies").select("company_id").eq("employee_id", employeeId)),

  /** allCompanies = true saves an empty list (= adgang til alle). */
  async saveAccess(employeeId: number, companyIds: number[], allCompanies: boolean): Promise<void> {
    const { error } = await supabase.rpc("save_employee_access", {
      p_employee_id: employeeId,
      p_company_ids: allCompanies ? [] : companyIds,
    });
    if (error) {
      raise(error);
    }
  },

  budgetsFor: (year: number): Promise<HourBudgetRow[]> =>
    q<HourBudgetRow>(
      supabase.from("hour_budgets").select("id, company_id, department, period_type, hours, year, active").eq("year", year),
    ),

  async saveBudget(budget: BudgetInput): Promise<void> {
    const { error } = await supabase.from("hour_budgets").upsert(budget, { onConflict: "company_id,department,year" });
    if (error) {
      raise(error);
    }
  },

  async deleteBudget(id: number): Promise<void> {
    await q(supabase.from("hour_budgets").delete().eq("id", id).select("id"));
  },

  planFor: (department: string, year: number): Promise<PlanRow[]> =>
    q<PlanRow>(supabase.from("budget_plan").select("company_id, month, hours").eq("department", department).eq("year", year)),

  async savePlan(
    department: string,
    year: number,
    rows: { company_id: number; month: number; hours: number | null }[],
  ): Promise<void> {
    if (!rows.length) {
      return;
    }
    const { error } = await supabase.from("budget_plan").upsert(
      rows.map((r) => ({ company_id: r.company_id, department, year, month: r.month, hours: r.hours })),
      { onConflict: "company_id,department,year,month" },
    );
    if (error) {
      raise(error);
    }
  },

  absenceCodes: (): Promise<AbsenceCodeRow[]> =>
    q<AbsenceCodeRow>(supabase.from("absence_codes").select("code, label, source").order("sort")),

  async setAbsenceCode(employeeId: number, date: string, code: string | null | undefined): Promise<void> {
    const { error } = await supabase.rpc("set_absence_code", { p_emp: employeeId, p_date: date, p_code: code || "" });
    if (error) {
      raise(error);
    }
  },

  approvalsForPeriod: (periodId: number): Promise<ApprovalRow[]> =>
    q<ApprovalRow>(
      supabase.from("period_approvals").select("employee_id, leader_approved, economy_approved").eq("period_id", periodId),
    ),

  async setLeaderApproval(periodId: number, employeeId: number, value: boolean): Promise<void> {
    const { error } = await supabase.rpc("set_leader_approval", { p_period: periodId, p_emp: employeeId, p_val: value });
    if (error) {
      raise(error);
    }
  },

  async setEconomyApproval(periodId: number, employeeId: number, value: boolean): Promise<void> {
    const { error } = await supabase.rpc("set_economy_approval", { p_period: periodId, p_emp: employeeId, p_val: value });
    if (error) {
      raise(error);
    }
  },

  /** ÅTD saldo: medarbejderens start saldo (flex_start) + sum af Kontrol fra `from` til `to`. */
  async atdSaldo(from: string, to: string, employeeId: number): Promise<{ start: number; kontrol: number }> {
    const [emps, entries] = await Promise.all([
      q<{ flex_start: number | null; weekly_norm: WeeklyNorm | null }>(
        supabase.from("employees").select("flex_start, weekly_norm").eq("id", employeeId),
      ),
      q<KontrolEntry>(
        supabase
          .from("day_entries")
          .select("work_date, location, work_hours, absence_hours")
          .eq("employee_id", employeeId)
          .gte("work_date", from)
          .lte("work_date", to),
      ),
    ]);
    const emp = emps[0];
    return {
      start: Number(emp?.flex_start || 0),
      kontrol: kontrolSum(entries, emp?.weekly_norm),
    };
  },

  /** Normugen for en medarbejder (tidspunkter som "HH:MM"). */
  async normWeek(employeeId: number): Promise<NormDay[]> {
    const rows = await q<{ weekday: number; time_in: string | null; time_out: string | null; lunch_min: number }>(
      supabase.from("norm_week").select("weekday, time_in, time_out, lunch_min").eq("employee_id", employeeId).order("weekday"),
    );
    // Ugedage uden tider er tomme (forudfyldes som før).
    return rows.filter((r) => r.time_in && r.time_out).map((r) => ({
      weekday: Number(r.weekday),
      time_in: String(r.time_in).slice(0, 5),
      time_out: String(r.time_out).slice(0, 5),
      lunch_min: Number(r.lunch_min),
    }));
  },

  /** Gemmer hele normugen (RPC: skriver alle 7 ugedage i én transaktion; ugedage der ikke er med, bliver tomme). */
  async saveNormWeek(employeeId: number, days: NormDay[]): Promise<void> {
    const { error } = await supabase.rpc("save_norm_week", { p_employee_id: employeeId, p_days: days });
    if (error) {
      raise(error);
    }
  },

  proxyEmployees: (): Promise<ProxyEmployee[]> =>
    q<ProxyEmployee>(supabase.from("employees").select("id, name, weekly_norm, hired_date").eq("active", true).order("name")),

  /** Kalder edge function "onboard" (opret/nulstil login). */
  async manageLogin(action: string, email: string, password?: string): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke("onboard", { body: { action, email, password } });
    if (error) {
      let message: string = error.message;
      try {
        const body = await (error as { context?: { json(): Promise<{ error?: string } | null> } }).context?.json();
        if (body != null && body.error) {
          message = body.error;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return data;
  },
};

/** Fire-and-forget sign out. */
export function signOutNow(): void {
  supabase.auth.signOut();
}
