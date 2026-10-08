-- Leder-godkendelse låser perioden KUN for medarbejderen selv:
-- medarbejderen kan ikke længere rette, men afdelingens leder (og admin)
-- kan stadig. Fjerner lederen godkendelsen, er perioden åben igen.
-- Økonomi-godkendelsen (lønkørt) låser som før for alle.

-- Er medarbejderen leder-godkendt for datoen?
CREATE OR REPLACE FUNCTION timereg.is_emp_leader_approved(eid int, d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT EXISTS (
     SELECT 1 FROM period_approvals pa
     JOIN periods p ON p.id = pa.period_id
     WHERE pa.employee_id = eid AND pa.leader_approved
       AND d BETWEEN p.start_date AND p.end_date) $$;
GRANT EXECUTE ON FUNCTION timereg.is_emp_leader_approved(int, date) TO authenticated;

-- Skrive-reglerne: en almindelig medarbejder (hverken leder eller admin) kan
-- kun skrive egne rækker, så leder-låsen rammer netop medarbejderen selv.
ALTER POLICY de_insert ON timereg.day_entries
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));
ALTER POLICY de_update ON timereg.day_entries
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)))
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));
ALTER POLICY de_delete ON timereg.day_entries
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));

ALTER POLICY al_insert ON timereg.allocations
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));
ALTER POLICY al_update ON timereg.allocations
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)))
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));
ALTER POLICY al_delete ON timereg.allocations
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date)
    AND (timereg.me_is_manager() OR timereg.me_is_admin()
         OR NOT timereg.is_emp_leader_approved(employee_id, work_date)));

-- Godkendelser for en periode med navn og tidspunkt på hvem der godkendte
-- (til hover på fluebenene). SECURITY DEFINER fordi godkenderen kan sidde i
-- en anden afdeling end den man må læse medarbejdere i; synligheden af
-- rækkerne er den samme som pa_select.
CREATE OR REPLACE FUNCTION timereg.period_approval_details(p_period int)
RETURNS TABLE (employee_id int, leader_approved boolean, leader_by_name text, leader_at timestamptz,
               economy_approved boolean, economy_by_name text, economy_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT pa.employee_id, pa.leader_approved, lb.name, pa.leader_at,
          pa.economy_approved, eb.name, pa.economy_at
     FROM period_approvals pa
     LEFT JOIN employees lb ON lb.id = pa.leader_by
     LEFT JOIN employees eb ON eb.id = pa.economy_by
    WHERE pa.period_id = p_period
      AND (pa.employee_id = current_emp_id() OR me_is_economy()
           OR (me_is_manager() AND is_my_dept_employee(pa.employee_id))) $$;
REVOKE EXECUTE ON FUNCTION timereg.period_approval_details(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION timereg.period_approval_details(int) TO authenticated;

NOTIFY pgrst, 'reload schema';
