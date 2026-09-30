// Parity test: the rebuilt api.ts must compute exactly what the original production
// bundle computed. Both run against the same in-memory data (test/fakeSupabase.ts).
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Tables } from "../../test/fakeSupabase";
// @ts-expect-error untyped reference copy of the original bundle code
import { makeOriginal } from "../../test/original/data-layer.js";

const tables: Tables = {
  employees: [
    { id: 1, name: "Anne A", department: "Marketing", weekly_norm: [7.5, 7.5, 7.5, 7.5, 7, 0, 0], is_admin: false, is_manager: false, hired_date: null, hourly_rate: 500, payroll_number: 10001, active: true, auth_user_id: "u1" },
    { id: 2, name: "Bo B", department: "Digital Transformation", weekly_norm: [7.5, 7.5, 7.5, 7.5, 7, 0, 0], is_admin: true, is_manager: true, hired_date: "2026-08-01", hourly_rate: 850, payroll_number: 10002, active: true, auth_user_id: "u2" },
    { id: 3, name: "Cia C", department: "Økonomi", weekly_norm: [6, 6, 6, 6, 6, 0, 0], is_admin: false, is_manager: true, hired_date: null, hourly_rate: "100", payroll_number: null, active: true, auth_user_id: "u3" },
    { id: 4, name: "Dan D", department: "Marketing", weekly_norm: [7.5, 7.5, 7.5, 7.5, 7, 0, 0], is_admin: false, is_manager: false, hired_date: null, hourly_rate: 0, payroll_number: null, active: true, auth_user_id: null },
  ],
  companies: [
    { id: 10, name: "Topas Travel", kind: "selskab", billing_type: "loebende", expected_settlement: null, active: true, sort: 10 },
    { id: 11, name: "Disko Line", kind: "selskab", billing_type: "loebende", expected_settlement: null, active: true, sort: 20 },
    { id: 12, name: "Hotel Icefiord", kind: "selskab", billing_type: "loebende", expected_settlement: null, active: true, sort: 30 },
    { id: 20, name: "Projekt GL", kind: "projekt", billing_type: "loebende", expected_settlement: null, active: true, sort: 40 },
    { id: 21, name: "Projekt Booking", kind: "projekt", billing_type: "samlet", expected_settlement: "2027-03-01", active: true, sort: 50 },
    { id: 22, name: "Projekt Halv", kind: "projekt", billing_type: "loebende", expected_settlement: null, active: true, sort: 60 },
    { id: 23, name: "Projekt Uden Regler", kind: "projekt", billing_type: "loebende", expected_settlement: null, active: true, sort: 70 },
  ],
  billing_rules: [
    { source_company_id: 20, target_company_id: 10, share: 1 / 3, active: true },
    { source_company_id: 20, target_company_id: 11, share: 1 / 3, active: true },
    { source_company_id: 20, target_company_id: 12, share: 1 / 3, active: true },
    { source_company_id: 21, target_company_id: 10, share: 0.6, active: true },
    { source_company_id: 21, target_company_id: 11, share: 0.4, active: true },
    { source_company_id: 22, target_company_id: 12, share: "0.5", active: true },
  ],
  allocations: [] as Record<string, unknown>[],
  day_entries: [
    { employee_id: 1, work_date: "2026-09-01", location: "Kontor", location_note: null, absence_type: null, absence_note: null, absence_hours: null, absence_code: null, absence_choice: null, time_in: "08:00:00", time_out: "16:00:00", work_hours: 7.5, note: null },
    { employee_id: 1, work_date: "2026-09-02", location: "Kontor", location_note: null, absence_type: "Egen sygdom", absence_note: "læge", absence_hours: 2, absence_code: null, absence_choice: null, time_in: "08:00:00", time_out: "14:00:00", work_hours: 5.5, note: "x" },
    { employee_id: 1, work_date: "2026-09-03", location: null, location_note: null, absence_type: "Ferie", absence_note: null, absence_hours: null, absence_code: "2200", absence_choice: null, time_in: null, time_out: null, work_hours: null, note: null },
    { employee_id: 2, work_date: "2026-09-01", location: "Rejsedag", location_note: "Nuuk", absence_type: null, absence_note: null, absence_hours: null, absence_code: null, absence_choice: null, time_in: "07:00:00", time_out: "19:00:00", work_hours: 11.5, note: null },
    { employee_id: 3, work_date: "2026-09-01", location: null, location_note: null, absence_type: "Barn syg", absence_note: null, absence_hours: 6, absence_code: "20", absence_choice: null, time_in: null, time_out: null, work_hours: null, note: null },
    { employee_id: 3, work_date: "2025-12-01", location: null, location_note: null, absence_type: "Ferie", absence_note: null, absence_hours: null, absence_code: null, absence_choice: null, time_in: null, time_out: null, work_hours: null, note: null },
    { employee_id: 3, work_date: "2026-08-20", location: null, location_note: null, absence_type: "Egen sygdom", absence_note: null, absence_hours: 7.5, absence_code: null, absence_choice: null, time_in: null, time_out: null, work_hours: null, note: null },
  ],
  periods: [
    { id: 8, year: 2026, month_name: "August", start_date: "2026-07-27", end_date: "2026-08-23", locked: true },
    { id: 9, year: 2026, month_name: "September", start_date: "2026-08-24", end_date: "2026-09-27", locked: false },
  ],
  employee_companies: [{ employee_id: 1, company_id: 10 }, { employee_id: 1, company_id: 20 }],
  task_types: [{ name: "SoMe", department: "Marketing", active: true, sort: 1 }, { name: "Nyhedsbrev", department: "Marketing", active: true, sort: 2 }],
  default_allocations: [{ employee_id: 1, company_id: 10, share: 1 }],
  andet_fravaer_valg: [{ id: 1, label: "Lægebesøg – egen", active: true, sort: 10 }],
};

// Deterministic spread of allocations: every employee × company × task type over two months,
// with odd hour values that stress rounding (1/3 splits, 0.25 steps, string numerics).
let id = 1;
const dates = ["2026-08-25", "2026-08-31", "2026-09-01", "2026-09-15", "2026-09-27", "2026-10-02"];
for (const e of [1, 2, 3, 4]) for (const c of [10, 11, 12, 20, 21, 22, 23]) for (const [i, d] of dates.entries()) {
  if ((e * 7 + c + i) % 3 === 0) continue;
  const hours = ((e + c + i) % 7) * 0.75 + 0.25;
  tables.allocations.push({ id: id++, employee_id: e, company_id: c, work_date: d, hours: i % 2 ? String(hours) : hours, task_type: ["SoMe", "Nyhedsbrev", ""][(e + i) % 3], task_note: i === 2 ? "note" : null });
}

const fake = fakeSupabase(tables);
vi.doMock("./supabase", () => ({ supabase: fake }));
const { api } = await import("./api");
const original = makeOriginal(fake);

describe("rebuilt api.ts matches the original bundle", () => {
  it("ecoBilling (rebilling), single period", async () => {
    const rebuilt = await api.ecoBilling("2026-08-24", "2026-09-27");
    expect(rebuilt).toEqual(await original.at.ecoBilling("2026-08-24", "2026-09-27"));
    // guard against a vacuous pass: the fixture must exercise every branch
    expect(Object.keys(rebuilt.invoice).sort()).toEqual(["Disko Line", "Hotel Icefiord", "Projekt Halv", "Projekt Uden Regler", "Topas Travel"]);
    expect(rebuilt.projekter.map(p => p.billing)).toEqual(["samlet", "loebende", "loebende", "loebende"]);
    expect(rebuilt.parkeret).toHaveLength(1);
    expect(rebuilt.fordelt.kr).toBeGreaterThan(0);
  });
  it("ecoBilling, several periods", async () => {
    expect(await api.ecoBilling("2026-07-27", "2026-12-31")).toEqual(await original.at.ecoBilling("2026-07-27", "2026-12-31"));
  });
  it("ecoAbsence (holiday year from 1 Sep)", async () => {
    expect(await api.ecoAbsence("2026-08-24", "2026-09-27")).toEqual(await original.at.ecoAbsence("2026-08-24", "2026-09-27"));
    expect(await api.ecoAbsence("2026-07-27", "2026-08-23")).toEqual(await original.at.ecoAbsence("2026-07-27", "2026-08-23"));
  });
  it("ecoMatrix", async () => {
    expect(await api.ecoMatrix("2026-08-24", "2026-09-27")).toEqual(await original.at.ecoMatrix("2026-08-24", "2026-09-27"));
  });
  it("myPeriod, periodDays, day", async () => {
    expect(await api.myPeriod("2026-08-24", "2026-09-27")).toEqual(await original.at.myPeriod("2026-08-24", "2026-09-27"));
    expect(await api.myPeriod("2026-08-24", "2026-09-27", 3)).toEqual(await original.at.myPeriod("2026-08-24", "2026-09-27", 3));
    expect(await api.periodDays("2026-08-24", "2026-09-27")).toEqual(await original.at.periodDays("2026-08-24", "2026-09-27"));
    expect(await api.day("2026-09-02")).toEqual(await original.at.day("2026-09-02"));
  });
  it("bootstrap and session employee", async () => {
    const [a, b] = [await api.bootstrap(), await original.at.bootstrap()];
    expect(a).toEqual(b);
    expect(await api.session()).toEqual(await original.at.session());
  });
});
