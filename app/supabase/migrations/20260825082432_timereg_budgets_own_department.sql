-- Audit-designvalg (Gorm 2026-08-25): timepuljer og månedsplaner må kun
-- læses af egen afdeling — admins ser alt.
DROP POLICY budgets_select ON timereg.hour_budgets;
CREATE POLICY budgets_select ON timereg.hour_budgets FOR SELECT TO authenticated
  USING (timereg.me_is_admin() OR department = timereg.me_department());

DROP POLICY bp_select ON timereg.budget_plan;
CREATE POLICY bp_select ON timereg.budget_plan FOR SELECT TO authenticated
  USING (timereg.me_is_admin() OR department = timereg.me_department());
