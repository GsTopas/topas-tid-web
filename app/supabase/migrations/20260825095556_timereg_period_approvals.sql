-- To-trins godkendelse pr. medarbejder pr. lønperiode:
--   1) afdelingsleder godkender  2) økonomi godkender = personlig lås
CREATE TABLE timereg.period_approvals (
  period_id int NOT NULL REFERENCES timereg.periods(id),
  employee_id int NOT NULL REFERENCES timereg.employees(id),
  leader_approved boolean NOT NULL DEFAULT false,
  leader_by int REFERENCES timereg.employees(id),
  leader_at timestamptz,
  economy_approved boolean NOT NULL DEFAULT false,
  economy_by int REFERENCES timereg.employees(id),
  economy_at timestamptz,
  PRIMARY KEY (period_id, employee_id)
);
ALTER TABLE timereg.period_approvals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON timereg.period_approvals TO authenticated;

-- Læsning: egen status, leders afdeling, økonomi/admin alt.
CREATE POLICY pa_select ON timereg.period_approvals FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id() OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));
-- Skrivning KUN via godkendelses-funktionerne nedenfor (ingen write-policies).

-- Er medarbejderen økonomi-låst for datoen?
CREATE OR REPLACE FUNCTION timereg.is_emp_locked(eid int, d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT EXISTS (
     SELECT 1 FROM period_approvals pa
     JOIN periods p ON p.id = pa.period_id
     WHERE pa.employee_id = eid AND pa.economy_approved
       AND d BETWEEN p.start_date AND p.end_date) $$;
GRANT EXECUTE ON FUNCTION timereg.is_emp_locked(int, date) TO authenticated;

-- Leder-godkendelse: leder i medarbejderens afdeling, eller admin.
CREATE OR REPLACE FUNCTION timereg.set_leader_approval(p_period int, p_emp int, p_val boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT (me_is_admin() OR (me_is_manager() AND is_my_dept_employee(p_emp))) THEN
    RAISE EXCEPTION 'Kun afdelingsleder eller admin kan leder-godkende';
  END IF;
  IF NOT p_val AND EXISTS (SELECT 1 FROM period_approvals
      WHERE period_id = p_period AND employee_id = p_emp AND economy_approved) THEN
    RAISE EXCEPTION 'Økonomi har allerede godkendt — bed økonomi låse op først';
  END IF;
  INSERT INTO period_approvals (period_id, employee_id, leader_approved, leader_by, leader_at)
  VALUES (p_period, p_emp, p_val, current_emp_id(), now())
  ON CONFLICT (period_id, employee_id) DO UPDATE
    SET leader_approved = p_val, leader_by = current_emp_id(), leader_at = now();
END $$;
GRANT EXECUTE ON FUNCTION timereg.set_leader_approval(int, int, boolean) TO authenticated;

-- Økonomi-godkendelse (= personlig lås): kun økonomi/admin, kræver leder først.
CREATE OR REPLACE FUNCTION timereg.set_economy_approval(p_period int, p_emp int, p_val boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT me_is_economy() THEN
    RAISE EXCEPTION 'Kun økonomi/admin kan økonomi-godkende';
  END IF;
  IF p_val AND NOT EXISTS (SELECT 1 FROM period_approvals
      WHERE period_id = p_period AND employee_id = p_emp AND leader_approved) THEN
    RAISE EXCEPTION 'Afdelingslederen skal godkende først';
  END IF;
  INSERT INTO period_approvals (period_id, employee_id, leader_approved, economy_approved, economy_by, economy_at)
  VALUES (p_period, p_emp, true, p_val, current_emp_id(), now())
  ON CONFLICT (period_id, employee_id) DO UPDATE
    SET economy_approved = p_val, economy_by = current_emp_id(), economy_at = now();
END $$;
GRANT EXECUTE ON FUNCTION timereg.set_economy_approval(int, int, boolean) TO authenticated;

-- Skrive-reglerne strammes: økonomi-lås blokerer + leder/admin må redigere
-- på vegne af (egen afdeling) frem til låsen.
DROP POLICY de_insert ON timereg.day_entries;
DROP POLICY de_update ON timereg.day_entries;
DROP POLICY de_delete ON timereg.day_entries;
CREATE POLICY de_insert ON timereg.day_entries FOR INSERT TO authenticated
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));
CREATE POLICY de_update ON timereg.day_entries FOR UPDATE TO authenticated
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date))
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));
CREATE POLICY de_delete ON timereg.day_entries FOR DELETE TO authenticated
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));

DROP POLICY al_insert ON timereg.allocations;
DROP POLICY al_update ON timereg.allocations;
DROP POLICY al_delete ON timereg.allocations;
CREATE POLICY al_insert ON timereg.allocations FOR INSERT TO authenticated
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));
CREATE POLICY al_update ON timereg.allocations FOR UPDATE TO authenticated
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date))
  WITH CHECK (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));
CREATE POLICY al_delete ON timereg.allocations FOR DELETE TO authenticated
  USING (
    (employee_id = timereg.current_emp_id()
     OR timereg.me_is_admin()
     OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)))
    AND NOT timereg.date_is_locked(work_date)
    AND NOT timereg.is_emp_locked(employee_id, work_date));

NOTIFY pgrst, 'reload schema';
