-- Leder-godkendelse: KUN lederen i medarbejderens egen afdeling.
-- (Admin-kasketten giver ikke længere leder-kryds på tværs — økonomi-
-- låsen er stadig økonomi-ledere/admin, da lønkørslen går på tværs.)
CREATE OR REPLACE FUNCTION timereg.set_leader_approval(p_period int, p_emp int, p_val boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT (me_is_manager() AND is_my_dept_employee(p_emp)) THEN
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

-- Gorm er leder i Digital Transformation
UPDATE timereg.employees SET is_manager = true
WHERE name ILIKE 'Gorm%Nielsen' AND department = 'Digital Transformation';
