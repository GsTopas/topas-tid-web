-- Admin-funktioner i browseren: skrive-policies + kolonne-nedlåsning.

-- 1) employees: kolonne-niveau så pin/session_token/failed_logins ALDRIG
--    kan læses eller skrives fra browseren (de er Streamlit-interne).
REVOKE SELECT, INSERT, UPDATE, DELETE ON timereg.employees FROM authenticated;
GRANT SELECT (id, name, email, department, is_admin, is_manager, active,
              hourly_rate, weekly_norm, flex_start, auth_user_id)
  ON timereg.employees TO authenticated;
GRANT UPDATE (name, email, department, is_admin, is_manager, active,
              hourly_rate, weekly_norm, flex_start)
  ON timereg.employees TO authenticated;
GRANT INSERT (name, email, department, is_admin, is_manager, active,
              hourly_rate, weekly_norm, flex_start)
  ON timereg.employees TO authenticated;
-- Nye medarbejdere oprettet fra browseren har intet Streamlit-password
ALTER TABLE timereg.employees ALTER COLUMN pin SET DEFAULT 'ikke-sat';

CREATE POLICY emp_admin_update ON timereg.employees FOR UPDATE TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());
CREATE POLICY emp_admin_insert ON timereg.employees FOR INSERT TO authenticated
  WITH CHECK (timereg.me_is_admin());

-- 2) Opsætningstabeller: admin må alt (SELECT-policies findes i forvejen)
CREATE POLICY comp_admin ON timereg.companies FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());
CREATE POLICY tt_admin ON timereg.task_types FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());
CREATE POLICY br_admin ON timereg.billing_rules FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());
CREATE POLICY ecs_admin ON timereg.employee_companies FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());
CREATE POLICY hb_admin ON timereg.hour_budgets FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());

-- 3) periods: økonomi/admin må KUN ændre locked-kolonnen (lås/åbn periode)
REVOKE UPDATE ON timereg.periods FROM authenticated;
GRANT UPDATE (locked) ON timereg.periods TO authenticated;
CREATE POLICY per_lock ON timereg.periods FOR UPDATE TO authenticated
  USING (timereg.me_is_economy()) WITH CHECK (timereg.me_is_economy());

NOTIFY pgrst, 'reload schema';
