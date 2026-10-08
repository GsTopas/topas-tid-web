-- Normuge: hver medarbejders typiske mødt/gået/frokost pr. ugedag (0 = mandag … 6 = søndag).
-- Bruges kun til at forudfylde tomme dage i Min tid; normtimer og saldo regnes stadig af employees.weekly_norm.
-- En ugedag uden tider (time_in NULL) forudfyldes som før (08:00 + normtid).
CREATE TABLE timereg.norm_week (
  employee_id integer NOT NULL REFERENCES timereg.employees(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  time_in time,
  time_out time,
  lunch_min integer NOT NULL DEFAULT 30 CHECK (lunch_min BETWEEN 0 AND 240),
  PRIMARY KEY (employee_id, weekday),
  CHECK ((time_in IS NULL AND time_out IS NULL) OR time_out > time_in)
);

ALTER TABLE timereg.norm_week ENABLE ROW LEVEL SECURITY;

-- Læses af samme personer som må registrere for medarbejderen i Min tid. Skrivning kun via save_norm_week.
CREATE POLICY nw_select ON timereg.norm_week FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id()
         OR timereg.me_is_admin()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

GRANT SELECT ON timereg.norm_week TO authenticated;

-- Gemmer hele normugen på én gang: alle 7 ugedage skrives (upsert); ugedage der ikke er med i p_days, får tomme tider.
-- p_days: [{"weekday":0,"time_in":"08:00","time_out":"16:00","lunch_min":30}, …]
CREATE OR REPLACE FUNCTION timereg.save_norm_week(p_employee_id integer, p_days jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  IF NOT (p_employee_id = current_emp_id()
          OR me_is_admin()
          OR (me_is_manager() AND is_my_dept_employee(p_employee_id))) THEN
    RAISE EXCEPTION 'Du kan kun sætte normuge for dig selv eller din egen afdeling';
  END IF;
  INSERT INTO norm_week (employee_id, weekday, time_in, time_out, lunch_min)
  SELECT p_employee_id, w, (d->>'time_in')::time, (d->>'time_out')::time, COALESCE((d->>'lunch_min')::integer, 30)
    FROM generate_series(0, 6) w
    LEFT JOIN jsonb_array_elements(COALESCE(p_days, '[]'::jsonb)) d ON (d->>'weekday')::integer = w
  ON CONFLICT (employee_id, weekday) DO UPDATE
    SET time_in = EXCLUDED.time_in, time_out = EXCLUDED.time_out, lunch_min = EXCLUDED.lunch_min;
END;
$function$;

REVOKE ALL ON FUNCTION timereg.save_norm_week(integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION timereg.save_norm_week(integer, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
