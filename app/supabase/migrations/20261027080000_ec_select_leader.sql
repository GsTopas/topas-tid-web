-- "Registrerer for": en afdelingsleder skal kunne se, hvilke selskaber/projekter
-- medarbejderne i egen afdeling har adgang til, så Timefordeling viser personens
-- egne valgmuligheder (ikke lederens).
DROP POLICY IF EXISTS ec_select ON timereg.employee_companies;
CREATE POLICY ec_select ON timereg.employee_companies FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id()
         OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

NOTIFY pgrst, 'reload schema';
