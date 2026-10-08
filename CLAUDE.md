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
- **Writes that must be atomic or cross-checked go through SECURITY DEFINER RPCs** with their own permission check: `save_billing_rules`, `save_project`, `save_employee_access`, `save_task_type`, `set_leader_approval`, `set_economy_approval`, `set_absence_code`. *Why:* on 25 Aug a delete-then-insert of billing rules from the browser lost the rules when the insert failed. `department_rows` is also an RPC, so department members can see aggregated kr without seeing colleagues' hourly rates.
  `department_shared_projects` (Afdelingsindsigt → "Fælles projekter") shows, for projects (`kind = projekt`) the department itself has hours on, every department's hours and kr as totals per department and month; no names or rates.
- **Schema changes are migrations.** Add `app/supabase/migrations/<timestamp>_<name>.sql` and apply it with the Supabase MCP `apply_migration` using the same name. End DDL with `NOTIFY pgrst, 'reload schema';`. Column-level grants on `employees` are deliberate (internal columns are hidden), so grant new columns explicitly.
- Login management (create, reset or delete a login) needs the service role, so it lives in the Edge Function `onboard`. Admins only; new users get `must_change` and must pick their own password (≥ 8 chars with at least one letter and one digit: Supabase Auth rejects anything else, including a generated temp password).
- "Glemt password?" on the login screen calls `resetPasswordForEmail` with `redirectTo` = the app's own URL. The confirmation always says the mail was sent, even for unknown addresses (Gorm's rule: don't reveal which mails exist), so errors are only logged to the console. The mail link logs the person in and the app forces "Vælg nyt password" (`openedFromRecoveryLink` in `lib/supabase.ts`). The app URL must be in the Supabase Auth Redirect URLs, otherwise the link falls back to the shared Site URL (teg-plan).
- The app polls `./?v=…` every 10 min and shows "Ny version klar". That's why the bundle has a hashed filename.
- **Phone app = PWA** (since 7 Oct 2026): `app/public/manifest.webmanifest` + icons and the meta tags in `app/index.html` let employees add Topas Tid to their home screen (iPhone: Safari → Del → "Føj til hjemmeskærm"; Android: Chrome → "Installér app"). No service worker on purpose: nothing is cached offline, so the version check above keeps working. On iPhone the home-screen app has its own login (separate from Safari). The phone layout is one `@media (max-width: 700px)` block at the end of `styles.css`, tuned for Min tid and Min periode; inputs are 16px there so iOS doesn't zoom. The allocation table turns into cards using the `a-*` classes and `data-label` on its cells.

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
  - **Leader approval locks only the employee** (since 8 Oct 2026): the employee can no longer edit that period, but leaders and admins still can (RLS: `is_emp_leader_approved()` in the `day_entries`/`allocations` write policies; Min tid shows "Din leder har godkendt perioden"). Removing the leader checkmark opens the period for the employee again.
  - Hovering a checkmark in Afdelingsoverblik shows who approved and when (`leader_by`/`leader_at`, `economy_by`/`economy_at`), read via the RPC `period_approval_details` so names are visible across departments.
- **A day** is one row in `day_entries` (unique per employee and date).
  - Day types: Kontor / Andet sted / Rejsedag (working), Ferie / Egen sygdom / Barn syg / Øvrigt fravær (absence), and "Ingen" (deletes the day).
  - A working day can also carry partial absence (a doctor's visit and similar) via "Fravær/ferie samme dag?". Its choice **½ feriedag** (since 8 Oct 2026) is stored as `absence_type = Ferie` on a working day (`location` set), pre-filled with half the day's norm as absence hours; it counts as **0,5 feriedag** (`holidayDays` in `lib/ferie.ts`) in Fravær & løn, while a whole Ferie day counts 1.
- **Work hours** = time out − time in − lunch − partial absence, rounded to a **quarter hour**. Times are picked in 5-minute steps, and lunch defaults to 30 min.
  - *Why:* this mirrors the old paper and Excel sheet ("8–16 = 7,5 t").
  - Norm: `employees.weekly_norm` is a Mon..Sun array (default 7,5/7,5/7,5/7,5/7/0/0).
  - Days before `hired_date` are not counted as missing.
  - **Normuge** (`norm_week`, since 8 Oct 2026): Min tid → "⚙️ Konfigurer normuge" sets each person's usual mødt/gået/frokost per weekday. It only pre-fills days with no registration (a pre-filled day must still be saved); a weekday without a row falls back to 08:00 + norm + ½ h. Hours, saldo and missing days still use `weekly_norm`; the view flags weekdays whose normuge hours differ from it. Readable by the person, their department's leader and admins (RLS); written only through the RPC `save_norm_week` (one row per weekday; empty times = not set).
- **Kontrol and ÅTD saldo** (Min periode / Medarbejder pr. periode): Kontrol per day = work hours + absence hours − the day's norm, only for days with a location. The ÅTD SALDO row = `employees.flex_start` ("Start saldo" in Settings) + the Kontrol sum from the first payroll period of the selected period's year to the end of the selected period (`api.atdSaldo`, `lib/saldo.ts`).
- **Allocations** (`allocations`) split a day's work hours across companies and projects by task type. Several lines per day are allowed, and each save deletes and re-inserts the whole day. The day's status icon is 🟢 when the split equals the work hours, 🟠 when partial, and 🔴 when a past norm day is missing. **Task type is mandatory** (a DB trigger enforces it), except for Hotel & Administration or departments with no task types. `allocations.task_type` stores the task type's **name**, not its id: renaming goes through `save_task_type`, which renames the department's existing lines in the same transaction, and Min tid shows a name that is no longer an active option as "(udgået)" instead of blank.
- **Absence pay codes** (`absence_codes`, Lessor): Barn syg → 20 automatically (trigger), Andet fravær → 50 (firmabetalt, with a choice from `andet_fravaer_valg`) or 51 (egen betalt). Sickness (10 vs 13 § 56) and holiday (2200 vs 2300) are coded by Økonomi. **Holiday days are counted per Danish holiday year, 1 Sep–31 Aug.**
- **Rebilling** (the core; see `api.ecoBilling`):
  - The amount is hours × **the employee's own `hourly_rate`**. Invoices show columns per rate: 100 / 500 / 850 kr, plus any others.
  - `companies.kind`: `selskab` (a company, invoiced for its own hours) or `projekt`. Settings has separate tabs **Selskaber** and **Projekter** (split 8 Oct 2026; a row's kind can no longer be changed in the UI).
  - A project's `billing_type` is its type in Settings → Projekter: `loebende` = "Projekt (Løbende pr. måned)" (invoiced each period like drift; Afregning is locked) or `samlet` = "Projekt (Samlet til afslutning)" (kept **out** of the monthly invoice and accumulated until the project ends, with an editable `expected_settlement` date).
  - **A løbende project must have fordelingsnøgler** (≥ 1 active `billing_rules` row with share > 0). Deferred constraint triggers on `companies` and `billing_rules` enforce it at commit, so projects are saved through the RPC `save_project` (project + optional rules in one transaction). In the UI, saving a løbende project without keys opens a pop-up (`FordelingsDialog`) to set them. Only admin sets keys; other leaders can edit projects and create samlede projects.
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
- Min tid reminds about an unsaved day: switching day, period, "Registrerer for" or top tab with changes asks "Du har ikke gemt din dag" (Gem og fortsæt / Fortsæt uden at gemme / Bliv på dagen), and closing the page or "Log ud" warns too (Gorm wants the tab switch to ask as well, even though Min tid's state survives it). "Fortsæt uden at gemme" resets the form to its last loaded/saved state. Dirty = the form differs from what was last loaded or saved (`formChanged` in `pages/mintid/unsaved.ts`); locked periods never ask. The guard and pending action live in `useMinTid` (`mt.guard`), and the dialog renders in MinTid.
- Editable admin tables (Medarbejdere, Selskaber, Projekter, Opgavetyper) have **no 💾 per row**. Edits mark the row dirty (`useDirtyRows` in `pages/settings/shared.tsx`), and one "💾 Gem alle" bar (`SaveAllBar`) saves only the changed rows. Rows that fail stay unsaved, and switching tab or leaving the page with unsaved edits asks first. Per-row actions such as "Opret login" / "Nulstil pw" stay on the row. New editable tables should follow the same pattern.
- Known gaps (not yet fixed; see `docs/RECOVERY.md`):
  - 2027 periods are missing.
  - `saveDay` is not atomic and should become an RPC.
  - `department_rows` still allows any Økonomi member.
  - `form_drafts` is unused.
  - Creating an employee with an existing name shows the raw DB error (`employees_name_key`) instead of a friendly message.
- `app/test/original/data-layer.js` is the original (de-minified) data layer. `src/lib/api.parity.test.ts` proves `api.ts` computes identical results; when you intentionally change `api.ts` behaviour, update or drop the affected parity case.
