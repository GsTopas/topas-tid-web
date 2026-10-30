-- "Godkender alle afdelinger": en person med fluebenet kan leder-godkende medarbejdere i alle
-- afdelinger (ikke kun sin egen). Sættes af admin i Settings → Medarbejdere (fx Malene og Lone).
-- Undtagelse fra reglen fra 25. aug. om, at kun afdelingens egen leder godkender.
ALTER TABLE timereg.employees
  ADD COLUMN approves_all_departments boolean NOT NULL DEFAULT false;

GRANT SELECT (approves_all_departments), UPDATE (approves_all_departments), INSERT (approves_all_departments)
  ON timereg.employees TO authenticated;

CREATE OR REPLACE FUNCTION timereg.me_approves_all_departments() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = timereg AS
$$ SELECT COALESCE((SELECT approves_all_departments FROM employees
   WHERE auth_user_id = auth.uid() AND active), false) $$;
GRANT EXECUTE ON FUNCTION timereg.me_approves_all_departments() TO authenticated;

CREATE OR REPLACE FUNCTION timereg.set_leader_approval(p_period int, p_emp int, p_val boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT (me_approves_all_departments() OR (me_is_manager() AND is_my_dept_employee(p_emp))) THEN
    RAISE EXCEPTION 'Kun afdelingens egen leder kan leder-godkende';
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

NOTIFY pgrst, 'reload schema';
