# Topas Tid: recovered project overview

Recovered 2026-09-30 from three sources, since the original frontend source (`topas-tid-react`) is not on GitHub:

1. **Deployed build** in `GsTopas/topas-tid-web` (commit `7334593`, 29 Sep 2026). No source maps are shipped, so the code was de-minified by hand. See `frontend-recovered/`.
2. **Live Supabase database** (project ref `bymurhqfcyxdhrayddoz`, schema `timereg`). Its full migration history is stored in `supabase_migrations.schema_migrations`, so the backend is effectively intact as code.
3. **Retired Streamlit app** in `GsTopas/topas-tid` (private). This was the first version (29 Jul to 25 Aug 2026), and its README documents the original conventions.

## 1. What it is

Topas Tid replaces the Excel timesheet at Topas Travel. Employees register each working day, absence, and how their hours split across the sister companies and projects they worked for. Økonomi then:

- approves the hours,
- runs payroll absence codes (Lessor), and
- produces the **rebilling invoice basis** (viderefakturering): which company pays for whose hours, at what hourly rate.

UI language is Danish, the title is "Topas Tid (Beta)", and PDFs say "Topas Travel".

## 2. Architecture

| Layer | What |
|---|---|
| Frontend | React SPA built with Vite, one bundle (`assets/index-*.js`), served from GitHub Pages at `/topas-tid-web/` (relative base `./`). Libraries: `@supabase/supabase-js`, jsPDF + jspdf-autotable (PDF), html2canvas, fflate (xlsx export). No router: tabs are held in state. |
| Backend | Supabase only. Auth (email + password), PostgREST on schema `timereg`, RLS on every table, SECURITY DEFINER RPCs for writes that need cross-row checks, and one Edge Function `onboard` for login admin. |
| Deploy | Build locally, then commit the `dist/` output to `topas-tid-web` `main`. GitHub Pages serves it. Each commit is one deploy. The app polls `./?v=…` every 10 min and shows a "Ny version klar" banner when the bundle hash changes. |
| Secrets | Only the public anon key is in the bundle (normal for Supabase). The service role key lives only in the Edge Function environment. |

The same Supabase project also hosts other apps (`topas-analyst`, `teg-plan`, n8n tables) in other schemas. Timereg is isolated in `timereg`.

## 3. Roles

Derived from `employees` flags. The frontend computes `can_economy = is_admin || (department == 'Økonomi' && is_manager)`, and the DB's `me_is_economy()` matches it since 28 Sep.

| Role | Sees tabs | Can do |
|---|---|---|
| Employee | Min tid, Min periode, Afdelings indsigt | Register own days in unlocked periods, save a personal default split |
| Manager (`is_manager`) | + Medarbejder pr. periode, Afdelings overblik, Settings (partial) | Read own department's registrations, register on behalf of own department, leader-approve own department, edit companies/projects, own department's task types and hour pools |
| Økonomi manager / admin (`can_economy`) | + Fakturering, Fravær & løn | See everything, economy-approve (= payroll lock), lock periods, set pay codes |
| Admin (`is_admin`) | + Settings: Medarbejdere, Fordelingsregler, Projekt-adgang | Create employees and logins, billing rules, access lists |

Departments (hard-coded list in the UI): Marketing, Økonomi, Digital Transformation, IT, Hotel & Administration.

## 4. Data model (schema `timereg`)

| Table | Purpose | Notes |
|---|---|---|
| `employees` | People | `weekly_norm` jsonb [man..søn] (default 7.5×4 + 7), `hourly_rate`, `department`, `is_admin`, `is_manager`, `hired_date` (days before it don't count as missing), `payroll_number` (Lessor), `flex_start`, `auth_user_id` → Supabase Auth. Column-level grants hide internals. |
| `periods` | Payroll periods | These **do not follow calendar months** (e.g. Juli = 22.06–26.07). `locked` = the period is closed for everyone. There are 12 rows for 2026; **2027 is not seeded yet.** |
| `companies` | Sister companies **and** projects | `kind` = `selskab` or `projekt`. `billing_type` = `loebende` or `samlet` (projects only). `expected_settlement` date for `samlet`. `sort`, `active`. |
| `day_entries` | One row per employee per day | `location` (Kontor / Andet sted / Rejsedag, or NULL for an absence day), `absence_type` (Ferie / Egen sygdom / Barn syg / Øvrigt fravær), `absence_hours`, `absence_code` → `absence_codes`, `absence_choice`, `time_in`, `time_out`, `work_hours`, notes. Unique (employee_id, work_date). |
| `allocations` | The rebilling lines: hours per day per company/project per task type | Several lines per day are allowed. The app writes them by deleting and re-inserting per day. `task_type` is required by trigger, except for Hotel & Administration or departments with no task types. |
| `billing_rules` | Distribution rules | source (a project) → target (a company) with `share` (0–1, summing to ≤ 1). Example: Projekt GL → ⅓ Topas Travel, ⅓ Hotel Icefiord, ⅓ Disko Line. |
| `employee_companies` | Which companies/projects an employee may register on | An empty list means all. |
| `default_allocations` | Personal default split (shares) | Used by the "gem som standardfordeling" button. |
| `task_types` | Task types per department | For example Marketing: SoMe, Nyhedsbrev…; IT: Spectra, API… |
| `hour_budgets` | Hour pools: a company bought X hours per year or month from a department | |
| `budget_plan` | The manager's monthly plan per company | |
| `period_approvals` | Two-step approval per employee per period | Leader first, then economy. Economy approval = a personal lock. Written only via RPC. |
| `absence_codes` | Payroll codes | Codes 1, 10, 13, 20, 2200, 2300, 40, 50, 51, 90. The source says who sets each code (system / medarbejder / oekonomi). |
| `andet_fravaer_valg` | The 12 sub-choices for code 50 | Lægebesøg, Tandlæge, Flyttefri… |
| `form_drafts` | Draft autosave | A leftover from Streamlit. The React app only deletes rows. |

Current row counts: 15 employees, 20 companies, 374 day entries, 1,537 allocations, 13 billing rules, 40 task types.

**RPCs:**
- `department_rows(year, dept)`: aggregated department rows without exposing colleagues' rates.
- `save_billing_rules(source, rules[])`: atomic replace.
- `save_employee_access(emp, company_ids[])`: atomic replace.
- `set_leader_approval`, `set_economy_approval`, `set_absence_code`.

**Helper functions used by RLS:** `current_emp_id`, `me_is_admin`, `me_is_economy`, `me_is_manager`, `me_department`, `is_my_dept_employee`, `date_is_locked`, `is_emp_locked`.

**Triggers:**
- `auto_absence_code`: Barn syg → 20, Øvrigt fravær → 50 by default.
- `enforce_task_type`.

## 5. Time registration rules (Min tid)

- **Day types:** Kontor, Andet sted (with "hvor"), Rejsedag (with a note), Ferie, Egen sygdom, Barn syg, Andet – firmabetalt (code 50 + choice), Andet – egen betalt (code 51), and Ingen (deletes the day).
- **Work hours** = time out − time in − lunch − partial absence, rounded to the nearest **quarter hour**. Times are picked in 5-minute steps. Lunch defaults to 30 min (options 0/15/30/45/60/90). The default time out = 08:00 + norm + 30 min.
- **Partial absence on a working day** (doctor, partial sickness, child sick) reduces work hours but still counts in the total.
- The **split** must equal work hours. Status per day: 🟢 fully split, 🟠 partly split, 🔴 missing (a past workday with norm > 0 and no entry), or an absence icon.
- **Bulk fill** of a date range skips days with no norm and days before `hired_date`.
- **Periods:** the user can edit earlier periods until either the period is `locked` or their personal economy approval exists. The DB enforces both through RLS.
- Managers and admins can **register on behalf of** someone (a proxy dropdown).

## 6. Rebilling logic (Fakturering, `at.ecoBilling`)

Input for the selected period(s):
- all `allocations` (employee, company, hours, task_type),
- active `billing_rules`,
- `companies`, and
- each employee's `hourly_rate`.

1. **Amount** = hours × the employee's `hourly_rate`. Rates are shown in columns for 100 / 500 / 850 kr, plus any other rate that appears.
2. **Three categories:**
   - *Selskabs-drift*: hours on companies.
   - *Projekt løbende*: projects with `billing_type = loebende`, invoiced per period.
   - *Projekt samlet*: projects with `billing_type = samlet`. These are **kept out of the monthly invoice** and accumulated until the project ends.
3. **Distribution:** hours and amounts registered on a source project are moved to its target companies by `share`. Any remainder (1 − Σshare) stays on the source. Projects without rules are invoiced directly to the project's counterparty.
4. **Invoice basis per company:** one line per (department, employee, task type, source project), with a subtotal per department. PDF export: "Timeopgørelse", landscape, one per company. A combined PDF also includes the monthly overview and the final distribution.
5. **Projekt-økonomi:** accumulated consumption since project start, independent of the chosen period. It shows per-month hours and kr, the distribution per target company, and lines grouped per employee×task or per task type. For `samlet` projects the footer reads "VED AFSLUTNING".
6. From this tab, Økonomi can also lock or unlock a single period.

## 7. Other screens

- **Min periode / Medarbejder pr. periode:** a period table per day (time in, time out, work hours, absence, split, control) plus totals per company.
- **Afdelings indsigt:** a stacked bar chart of hours per company per month, with clickable bars and a detail panel. It shows dynamic KPIs, hour pools versus the yearly plan versus actual hours, and lets the manager edit the monthly plan.
- **Afdelings overblik:** a matrix of employees × days (missing, partial) with approval checkboxes (Leder ✓, then Økonomi 🔒). It has a department filter and a reminder list as an Excel export.
- **Fravær & løn:** an absence list for payroll reporting with Lessor payroll numbers, pay code editing, and balances per employee (Norm, Registreret, flex). Holiday days are counted per **Danish holiday year, 1 Sep–31 Aug**. Excel export.
- **Settings:**
  - Medarbejdere: create an employee, create or reset a login through `onboard` (random temporary password, forced change on first login).
  - Selskaber & projekter.
  - Fordelingsregler (shares must sum to ≤ 100 %).
  - Opgavetyper.
  - Projekt-adgang.
  - Timepuljer.

## 8. Gaps and risks found

1. **No source code.** The React source (`topas-tid-react`) exists only on Gorm's PC, if anywhere. The recovered JS is readable but minified-named. A rebuild or new source repo is the first real step.
2. **Two RPCs are missing from migrations.** `save_billing_rules` and `save_employee_access` were created by hand. Their definitions are saved in `supabase/functions-not-in-migrations.sql`.
3. **`department_rows` wasn't updated with the 28 Sep tightening.** It still lets *any* Økonomi member read any department (`me.department = 'Økonomi'`), while every other check now requires an Økonomi *manager*.
4. **2027 payroll periods are not seeded.** From 1 Jan 2027 the app will show "Ingen aktiv lønperiode".
5. **`saveDay` is not atomic.** It upserts the day, deletes allocations, then inserts allocations as separate requests. A failure between the delete and the insert loses that day's split. It should become an RPC like the other atomic saves.
6. **No tests** for the React app. The Streamlit repo had pytest tests for the old Python logic.
7. **`form_drafts`** is only deleted by the React app and never written. It is dead weight unless autosave comes back.

## 9. How to continue

- **Backend changes:** use the Supabase MCP against project `bymurhqfcyxdhrayddoz`, schema `timereg`, and apply everything as named migrations.
- **Frontend changes need a source tree.** Options:
  - (a) Gorm pushes his local `topas-tid-react` to GitHub.
  - (b) Rebuild a clean Vite + React + TypeScript source from `frontend-recovered/` and this document. The data layer (`01-data-layer.js`) maps almost 1:1 to a typed `api.ts`.
  - Either way, add a GitHub Action that builds and publishes to Pages instead of committing `dist/` by hand.
