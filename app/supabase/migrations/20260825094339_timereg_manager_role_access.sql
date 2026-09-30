-- Leder-rolle (2026-08-26): ledere får LÆSE-adgang til egen afdelings
-- registreringer (Afdelings overblik) + kan administrere projekter,
-- egen afdelings opgavetyper og timepuljer. IKKE fakturering/løn.

-- Hjælper: hører medarbejder X til kalderens afdeling?
CREATE OR REPLACE FUNCTION timereg.is_my_dept_employee(eid int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT (SELECT department FROM employees WHERE id = eid)
   IS NOT DISTINCT FROM timereg.me_department() $$;
GRANT EXECUTE ON FUNCTION timereg.is_my_dept_employee(int) TO authenticated;

-- employees: leder ser egen afdelings medarbejdere (navne/norm til matrixen)
DROP POLICY emp_select ON timereg.employees;
CREATE POLICY emp_select ON timereg.employees FOR SELECT TO authenticated
  USING (id = timereg.current_emp_id() OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND department = timereg.me_department()));

-- day_entries + allocations: leder LÆSER egen afdelings (skrivning uændret: kun egne)
DROP POLICY de_select ON timereg.day_entries;
CREATE POLICY de_select ON timereg.day_entries FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

DROP POLICY al_select ON timereg.allocations;
CREATE POLICY al_select ON timereg.allocations FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

-- Settings-adgange for ledere
CREATE POLICY comp_mgr ON timereg.companies FOR ALL TO authenticated
  USING (timereg.me_is_manager()) WITH CHECK (timereg.me_is_manager());
CREATE POLICY tt_mgr ON timereg.task_types FOR ALL TO authenticated
  USING (timereg.me_is_manager() AND department = timereg.me_department())
  WITH CHECK (timereg.me_is_manager() AND department = timereg.me_department());
CREATE POLICY hb_mgr ON timereg.hour_budgets FOR ALL TO authenticated
  USING (timereg.me_is_manager() AND department = timereg.me_department())
  WITH CHECK (timereg.me_is_manager() AND department = timereg.me_department());
