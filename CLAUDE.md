# Topas Tid: guide for Claude

Topas Tid is Topas Travel's internal time registration and rebilling (viderefakturering) tool. It replaced an Excel timesheet.

- Employees register each day, any absence, and how their hours split across sister companies and projects.
- Økonomi approves the hours, codes absence for payroll (Lessor), and pulls the invoice basis: which company pays for whose hours, and at what rate.

Users are about 15 Danish-speaking employees. **All UI text is Danish**, and new features should be too. The owner and product decider is Gorm (gs@topas.dk), who is admin and head of Digital Transformation.

Live app: https://gstopas.github.io/topas-tid-web/ (production; people register time in it daily).

## Repo layout

```
app/                  ← the source. Vite 7 + React 18 + TypeScript (strict)
  src/lib/supabase.ts   Supabase client (anon key is public by design; RLS protects data)
  src/lib/api.ts        ALL database access. One `api` object; UI never calls supabase directly
  src/lib/format.ts     Danish number/date formatting (comma decimals, dd.mm.yyyy)
  src/lib/invoice.ts    rate columns + invoice-line/PDF helpers
  src/pages/            one file per tab (Min tid lives in App.tsx + pages/mintid/)
  src/styles.css        single stylesheet (dark theme); classNames are shared across pages
  supabase/migrations/  the database schema as SQL (exported from the live DB)
  supabase/functions/   Edge Function `onboard` (login admin)
assets/, index.html   ← OLD hand-committed build at repo root (served by Pages until the switch to Actions; delete afterwards)
docs/                 recovery notes (how the source was reconstructed)
.github/workflows/app.yml  PR: typecheck+test+build. Push to main: build (+ deploy to Pages once switched over)
```

**Deploy switch-over (one-time, done by Gorm):**
1. Set Settings → Pages → Source to "GitHub Actions".
2. Add the repo variable `PAGES_FROM_ACTIONS` = `true`.
3. Run the "App" workflow once (workflow_dispatch).

Until then Pages keeps serving the old build files in the repo root, unchanged. After switching, delete the root `index.html` and `assets/` in a follow-up PR.

Commands (run in `app/`): `npm ci`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`.

## History (why things look the way they do)

1. **v1: Streamlit + Python, 29 Jul to 25 Aug 2026.** Repo `GsTopas/topas-tid` (private, retired). It connected to Postgres directly and used a PIN login.
2. **v2: this React SPA, from 10 Aug 2026 (live since 25 Aug).** It is "Supabase-native": the browser talks to Supabase with the user's JWT, and **Row Level Security is the security boundary**. It reached full parity with Streamlit on 10 Aug, and Streamlit was retired on 25 Aug.
3. **Source lost 30 Sep 2026.** The original source lived only on Gorm's PC, which was reset. `app/` was **reconstructed from the deployed bundle** (webcrack decompile, then renamed and typed with behaviour kept identical) plus the live database. See `docs/RECOVERY.md`. Treat odd-looking logic as intentional unless a `NOTE(recovery)` comment says otherwise.

## Architecture rules

- **Backend = Supabase project `bymurhqfcyxdhrayddoz`, schema `timereg`.** The same project also hosts other apps (topas-analyst, teg-plan, n8n) in other schemas; never touch them.
- **Every table has RLS.** Role checks live in SQL helper functions: `current_emp_id()`, `me_is_admin()`, `me_is_economy()`, `me_is_manager()`, `me_department()`, `is_my_dept_employee()`, `date_is_locked()`, `is_emp_locked()`. The frontend hides tabs by role, but **the database is what enforces access**. Every new table needs RLS plus policies in the same style.
- **Writes that must be atomic or cross-checked go through SECURITY DEFINER RPCs** with their own permission check: `save_billing_rules`, `save_employee_access`, `set_leader_approval`, `set_economy_approval`, `set_absence_code`. *Why:* on 25 Aug a delete-then-insert of billing rules from the browser lost the rules when the insert failed. `department_rows` is also an RPC, so department members can see aggregated kr without seeing colleagues' hourly rates.
- **Schema changes are migrations.** Add `app/supabase/migrations/<timestamp>_<name>.sql` and apply it with the Supabase MCP `apply_migration` using the same name. End DDL with `NOTIFY pgrst, 'reload schema';`. Column-level grants on `employees` are deliberate (internal columns are hidden), so grant new columns explicitly.
- Login management (create, reset or delete a login) needs the service role, so it lives in the Edge Function `onboard`. Admins only; new users get `must_change` and must pick their own password (≥ 8 chars with at least one letter and one digit: Supabase Auth rejects anything else, including a generated temp password).
- The app polls `./?v=…` every 10 min and shows "Ny version klar". That's why the bundle has a hashed filename.

## Roles

| Flag | Meaning |
|---|---|
| (none) | Employee: own days only; tabs Min tid, Min periode, Afdelings indsigt |
| `is_manager` | Leader of **their own department**: reads the department's registrations, registers on behalf of them, leader-approves them, edits companies/projects plus own-department task types and hour pools |
| Økonomi + `is_manager`, or `is_admin` | "can_economy": all departments, Fakturering, Fravær & løn, payroll lock. *Why:* since 28 Sep, merely being *in* Økonomi no longer grants full insight |
| `is_admin` | Employees, logins, billing rules, project access. Admin does **not** override the leader approval (removed 25 Aug: only the department's own leader approves) |

Departments are a hard-coded list: Marketing, Økonomi, Digital Transformation, IT, Hotel & Administration.

## Domain rules (keep these when building features)

- **Payroll periods (`periods`) do not follow calendar months.** For example, Juli = 22.06–26.07. They come from Topas's "Månedsoversigt". Only 2026 is seeded; each new year must be inserted.
- **Locks.** `periods.locked` locks everyone. Economy approval in `period_approvals` locks one employee for one period. Both are enforced in RLS on `day_entries` and `allocations`. Økonomi can still set pay codes after locking.
- **Two-step approval:** the department leader approves, then an Økonomi manager approves (this is "lønkørt" and locks the period for that employee). A leader cannot un-approve after the economy approval.
- **A day** is one row in `day_entries` (unique per employee and date).
  - Day types: Kontor / Andet sted / Rejsedag (working), Ferie / Egen sygdom / Barn syg / Øvrigt fravær (absence), and "Ingen" (deletes the day).
  - A working day can also carry partial absence (a doctor's visit and similar).
- **Work hours** = time out − time in − lunch − partial absence, rounded to a **quarter hour**. Times are picked in 5-minute steps, and lunch defaults to 30 min.
  - *Why:* this mirrors the old paper and Excel sheet ("8–16 = 7,5 t").
  - Norm: `employees.weekly_norm` is a Mon..Sun array (default 7,5/7,5/7,5/7,5/7/0/0).
  - Days before `hired_date` are not counted as missing.
- **Allocations** (`allocations`) split a day's work hours across companies and projects by task type. Several lines per day are allowed, and each save deletes and re-inserts the whole day. The day's status icon is 🟢 when the split equals the work hours, 🟠 when partial, and 🔴 when a past norm day is missing. **Task type is mandatory** (a DB trigger enforces it), except for Hotel & Administration or departments with no task types.
- **Absence pay codes** (`absence_codes`, Lessor): Barn syg → 20 automatically (trigger), Andet fravær → 50 (firmabetalt, with a choice from `andet_fravaer_valg`) or 51 (egen betalt). Sickness (10 vs 13 § 56) and holiday (2200 vs 2300) are coded by Økonomi. **Holiday days are counted per Danish holiday year, 1 Sep–31 Aug.**
- **Rebilling** (the core; see `api.ecoBilling`):
  - The amount is hours × **the employee's own `hourly_rate`**. Invoices show columns per rate: 100 / 500 / 850 kr, plus any others.
  - `companies.kind`: `selskab` (a company, invoiced for its own hours) or `projekt`.
  - A project's `billing_type` is either `loebende` (invoiced each period like drift) or `samlet` (kept **out** of the monthly invoice and accumulated until the project ends, with an optional `expected_settlement` date).
  - `billing_rules` move a project's hours and kr to target companies by `share`. Shares sum to ≤ 1 and any remainder stays on the project. A project with no rules is invoiced directly to its counterparty. Example: Projekt GL → ⅓ Topas Travel, ⅓ Hotel Icefiord, ⅓ Disko Line.
  - Invoice lines go per company, broken down by department × employee × task type × source project, with department subtotals. There is a PDF per company ("Timeopgørelse") and a combined PDF.
  - Totals are computed on unrounded numbers (a 1/3 split must not produce −0,01 noise).
- **Hour pools** (`hour_budgets`) record how many hours a company bought from a department. `budget_plan` holds the leader's monthly plan. Both are readable only by their own department (and admins).
- Danish formatting everywhere: comma decimals, `da-DK` thousands, dd.mm.yyyy. Inputs accept both "3,5" and "3.5". CSV exports use `;`, a BOM, and protection against formula injection.

## Working conventions

- Commit messages are short Danish summaries, e.g. `Fakturering: kolonne pr. timepris (100/500/850)`.
- Before pushing, run `npm run typecheck && npm test && npm run build` in `app/`.
- For UI changes, keep the existing classNames and styles.css patterns (`page`, `pagehead`, `tabs`, `datatable`, `tablewrap`, `muted small`, `primary`, `ghost`, `toast`).
- Show user feedback with `flash("✓ …" | "❌ …" | "⚠️ …")`.
- Known gaps (not yet fixed; see `docs/RECOVERY.md`):
  - 2027 periods are missing.
  - `saveDay` is not atomic and should become an RPC.
  - `department_rows` still allows any Økonomi member.
  - `form_drafts` is unused.
  - Creating an employee with an existing name shows the raw DB error (`employees_name_key`) instead of a friendly message.
- `app/test/original/data-layer.js` is the original (de-minified) data layer. `src/lib/api.parity.test.ts` proves `api.ts` computes identical results; when you intentionally change `api.ts` behaviour, update or drop the affected parity case.
