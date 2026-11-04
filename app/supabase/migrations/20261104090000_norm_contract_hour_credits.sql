-- 1) Normtid med historik (norm_contract): en ændring af Norm/uge gælder fra starten af en
--    lønperiode og frem; tidligere perioder beregnes med den normtid, der gjaldt dengang.
--    Appen slår dagens kontrakt op som den seneste række med valid_from ≤ dato; findes ingen,
--    bruges employees.weekly_norm (som før). employees.weekly_norm holdes lig den nyeste række.
-- 2) Tilskrevne timer (hour_credits): timer som leder/admin tilskriver en medarbejder for en
--    lønperiode (fx afspadsering for vagttelefon). Indtastes manuelt; ingen automatisk konvertering.
--    Lægges til ÅTD saldo.

CREATE TABLE timereg.norm_contract (
  employee_id integer NOT NULL REFERENCES timereg.employees(id),
  valid_from date NOT NULL,
  weekly_norm jsonb NOT NULL,
  created_by integer REFERENCES timereg.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, valid_from)
);

ALTER TABLE timereg.norm_contract ENABLE ROW LEVEL SECURITY;

-- Læses af alle der læser medarbejderens dage (som norm_split). Skrivning kun via save_norm_contract.
CREATE POLICY nc_select ON timereg.norm_contract FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id()
         OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

GRANT SELECT ON timereg.norm_contract TO authenticated;

-- Sætter en ny normtid gældende fra p_valid_from (starten af en lønperiode). Første gang gemmes
-- den hidtidige normtid som gældende "fra start", så intet bagud ændrer sig.
CREATE OR REPLACE FUNCTION timereg.save_norm_contract(p_employee_id integer, p_valid_from date, p_weekly_norm jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
DECLARE
  v_old jsonb;
BEGIN
  IF NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan ændre normtid';
  END IF;
  IF p_valid_from IS NULL THEN
    RAISE EXCEPTION 'Vælg hvilken lønperiode den nye normtid gælder fra';
  END IF;
  IF jsonb_typeof(p_weekly_norm) IS DISTINCT FROM 'array' OR jsonb_array_length(p_weekly_norm) <> 7 THEN
    RAISE EXCEPTION 'Normtiden skal have 7 ugedage';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM norm_contract WHERE employee_id = p_employee_id) THEN
    SELECT weekly_norm INTO v_old FROM employees WHERE id = p_employee_id;
    IF v_old IS NOT NULL AND p_valid_from > DATE '1900-01-01' THEN
      INSERT INTO norm_contract (employee_id, valid_from, weekly_norm, created_by)
      VALUES (p_employee_id, DATE '1900-01-01', v_old, current_emp_id());
    END IF;
  END IF;

  INSERT INTO norm_contract (employee_id, valid_from, weekly_norm, created_by)
  VALUES (p_employee_id, p_valid_from, p_weekly_norm, current_emp_id())
  ON CONFLICT (employee_id, valid_from) DO UPDATE
    SET weekly_norm = EXCLUDED.weekly_norm, created_by = EXCLUDED.created_by, created_at = now();

  UPDATE employees SET weekly_norm = (
    SELECT weekly_norm FROM norm_contract WHERE employee_id = p_employee_id ORDER BY valid_from DESC LIMIT 1)
   WHERE id = p_employee_id;
END;
$function$;

REVOKE ALL ON FUNCTION timereg.save_norm_contract(integer, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION timereg.save_norm_contract(integer, date, jsonb) TO authenticated;

-- Fjerner en planlagt/fejlagtig normtidsændring (ikke den første "fra start").
CREATE OR REPLACE FUNCTION timereg.delete_norm_contract(p_employee_id integer, p_valid_from date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  IF NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan ændre normtid';
  END IF;
  IF p_valid_from = (SELECT min(valid_from) FROM norm_contract WHERE employee_id = p_employee_id) THEN
    RAISE EXCEPTION 'Den første normtid kan ikke slettes';
  END IF;
  DELETE FROM norm_contract WHERE employee_id = p_employee_id AND valid_from = p_valid_from;
  UPDATE employees SET weekly_norm = (
    SELECT weekly_norm FROM norm_contract WHERE employee_id = p_employee_id ORDER BY valid_from DESC LIMIT 1)
   WHERE id = p_employee_id
     AND EXISTS (SELECT 1 FROM norm_contract WHERE employee_id = p_employee_id);
END;
$function$;

REVOKE ALL ON FUNCTION timereg.delete_norm_contract(integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION timereg.delete_norm_contract(integer, date) TO authenticated;

CREATE TABLE timereg.hour_credits (
  employee_id integer NOT NULL REFERENCES timereg.employees(id),
  period_id integer NOT NULL REFERENCES timereg.periods(id),
  hours numeric(7,2) NOT NULL,
  note text,
  created_by integer REFERENCES timereg.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, period_id)
);

ALTER TABLE timereg.hour_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_select ON timereg.hour_credits FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id()
         OR timereg.me_is_economy()
         OR timereg.me_approves_all_departments()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

GRANT SELECT ON timereg.hour_credits TO authenticated;

-- Tilskriver timer for en lønperiode (én værdi pr. medarbejder og periode). 0/null sletter.
-- Samme ret som leder-godkendelse, plus admin.
CREATE OR REPLACE FUNCTION timereg.save_hour_credit(p_employee_id integer, p_period_id integer, p_hours numeric, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  IF NOT (me_is_admin() OR me_approves_all_departments()
          OR (me_is_manager() AND is_my_dept_employee(p_employee_id))) THEN
    RAISE EXCEPTION 'Kun afdelingens leder eller admin kan tilskrive timer';
  END IF;
  IF p_hours IS NULL OR p_hours = 0 THEN
    DELETE FROM hour_credits WHERE employee_id = p_employee_id AND period_id = p_period_id;
    RETURN;
  END IF;
  INSERT INTO hour_credits (employee_id, period_id, hours, note, created_by)
  VALUES (p_employee_id, p_period_id, p_hours, NULLIF(trim(p_note), ''), current_emp_id())
  ON CONFLICT (employee_id, period_id) DO UPDATE
    SET hours = EXCLUDED.hours, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION timereg.save_hour_credit(integer, integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION timereg.save_hour_credit(integer, integer, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
