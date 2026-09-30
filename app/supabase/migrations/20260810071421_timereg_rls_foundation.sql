-- ============================================================
-- FASE 1 af Supabase-native: auth-kobling + Row Level Security
-- Additivt: Streamlit/FastAPI forbinder som tabel-EJER (postgres)
-- og omgår RLS — de påvirkes ikke. Policies gælder kun browser-
-- adgang via Supabase Auth (rollen 'authenticated').
-- ============================================================

-- Kobling mellem Supabase Auth-brugere og medarbejdere
ALTER TABLE timereg.employees ADD COLUMN auth_user_id UUID UNIQUE;

-- Hjælpefunktioner (SECURITY DEFINER så de kan slå op i employees
-- uden selv at ramme RLS — search_path låst af sikkerhedshensyn)
CREATE OR REPLACE FUNCTION timereg.current_emp_id() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT id FROM employees WHERE auth_user_id = auth.uid() AND active $$;

CREATE OR REPLACE FUNCTION timereg.me_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT COALESCE((SELECT is_admin FROM employees
   WHERE auth_user_id = auth.uid() AND active), false) $$;

CREATE OR REPLACE FUNCTION timereg.me_is_economy() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT COALESCE((SELECT is_admin OR department = 'Økonomi' FROM employees
   WHERE auth_user_id = auth.uid() AND active), false) $$;

CREATE OR REPLACE FUNCTION timereg.me_department() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT department FROM employees WHERE auth_user_id = auth.uid() AND active $$;

CREATE OR REPLACE FUNCTION timereg.me_is_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT COALESCE((SELECT is_manager FROM employees
   WHERE auth_user_id = auth.uid() AND active), false) $$;

-- Er datoen i en LÅST periode? (bruges til at afvise skrivning)
CREATE OR REPLACE FUNCTION timereg.date_is_locked(d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT COALESCE((SELECT locked FROM periods
   WHERE d BETWEEN start_date AND end_date), false) $$;

-- ------------------------------------------------ slå RLS til
ALTER TABLE timereg.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.periods            ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.task_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.day_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.allocations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.employee_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.default_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.billing_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.hour_budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.budget_plan        ENABLE ROW LEVEL SECURITY;
ALTER TABLE timereg.form_drafts        ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------ policies
-- Medarbejdere: man ser sig selv; økonomi/admin ser alle.
-- Ingen skrive-policies (redigering sker fortsat i Streamlit/admin).
CREATE POLICY emp_select ON timereg.employees FOR SELECT TO authenticated
  USING (id = timereg.current_emp_id() OR timereg.me_is_economy());

-- Opslagstabeller: alle loggede ind må læse
CREATE POLICY periods_select    ON timereg.periods    FOR SELECT TO authenticated USING (true);
CREATE POLICY companies_select  ON timereg.companies  FOR SELECT TO authenticated USING (true);
CREATE POLICY tasktypes_select  ON timereg.task_types FOR SELECT TO authenticated USING (true);
CREATE POLICY budgets_select    ON timereg.hour_budgets FOR SELECT TO authenticated USING (true);

-- Dage: egne (+ økonomi læser alle); skrivning kun egne + ulåst periode
CREATE POLICY de_select ON timereg.day_entries FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy());
CREATE POLICY de_insert ON timereg.day_entries FOR INSERT TO authenticated
  WITH CHECK (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));
CREATE POLICY de_update ON timereg.day_entries FOR UPDATE TO authenticated
  USING (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date))
  WITH CHECK (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));
CREATE POLICY de_delete ON timereg.day_entries FOR DELETE TO authenticated
  USING (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));

-- Timefordelinger: samme mønster
CREATE POLICY al_select ON timereg.allocations FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy());
CREATE POLICY al_insert ON timereg.allocations FOR INSERT TO authenticated
  WITH CHECK (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));
CREATE POLICY al_update ON timereg.allocations FOR UPDATE TO authenticated
  USING (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date))
  WITH CHECK (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));
CREATE POLICY al_delete ON timereg.allocations FOR DELETE TO authenticated
  USING (employee_id = timereg.current_emp_id() AND NOT timereg.date_is_locked(work_date));

-- Projekt-adgang: egen liste (+ økonomi)
CREATE POLICY ec_select ON timereg.employee_companies FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy());

-- Standardfordeling: fuldt eje af egen
CREATE POLICY da_all ON timereg.default_allocations FOR ALL TO authenticated
  USING (employee_id = timereg.current_emp_id())
  WITH CHECK (employee_id = timereg.current_emp_id());

-- Kladder: fuldt eje af egen
CREATE POLICY fd_all ON timereg.form_drafts FOR ALL TO authenticated
  USING (employee_id = timereg.current_emp_id())
  WITH CHECK (employee_id = timereg.current_emp_id());

-- Fordelingsregler: kun økonomi/admin må læse
CREATE POLICY br_select ON timereg.billing_rules FOR SELECT TO authenticated
  USING (timereg.me_is_economy());

-- Månedsplan: afdelingen læser; leder (egen afdeling) eller admin skriver
CREATE POLICY bp_select ON timereg.budget_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY bp_write ON timereg.budget_plan FOR ALL TO authenticated
  USING (timereg.me_is_admin() OR (timereg.me_is_manager() AND department = timereg.me_department()))
  WITH CHECK (timereg.me_is_admin() OR (timereg.me_is_manager() AND department = timereg.me_department()));
