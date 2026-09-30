-- Økonomi-godkendelse (lønkørt-låsen) strammes: kun LEDERE i
-- Økonomi-afdelingen (eller admin) — ikke alle i afdelingen.
CREATE OR REPLACE FUNCTION timereg.set_economy_approval(p_period int, p_emp int, p_val boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT (me_is_admin() OR (me_department() = 'Økonomi' AND me_is_manager())) THEN
    RAISE EXCEPTION 'Kun ledere i Økonomi (eller admin) kan lønkøre/låse';
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
