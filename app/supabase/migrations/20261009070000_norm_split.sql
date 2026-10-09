-- Normugen kan nu også styre dagsnormen (saldo, manglende dage, Min periode).
-- 1) En ugedag i normugen kan være "Fridag" (0 timer).
-- 2) norm_split gemmer, fra hvilken dato en medarbejders dagsnorm følger normugen.
--    Appen bruger den kun, når dens ugesum er lig kontraktens (employees.weekly_norm);
--    ellers bruges kontraktens jævne fordeling som før. Ingen række = kontraktens fordeling.
--    Den gælder fra starten af den aktuelle lønperiode, eller fra næste periode hvis den
--    aktuelle er låst eller godkendt for medarbejderen, så godkendte perioder beholder deres tal.

ALTER TABLE timereg.norm_week ADD COLUMN day_off boolean NOT NULL DEFAULT false;

CREATE TABLE timereg.norm_split (
  employee_id integer NOT NULL REFERENCES timereg.employees(id),
  valid_from date NOT NULL,
  weekly_norm jsonb NOT NULL,
  PRIMARY KEY (employee_id, valid_from)
);

ALTER TABLE timereg.norm_split ENABLE ROW LEVEL SECURITY;

-- Læses af alle der læser medarbejderens dage (som day_entries). Skrivning kun via save_norm_week.
CREATE POLICY ns_select ON timereg.norm_split FOR SELECT TO authenticated
  USING (employee_id = timereg.current_emp_id()
         OR timereg.me_is_economy()
         OR (timereg.me_is_manager() AND timereg.is_my_dept_employee(employee_id)));

GRANT SELECT ON timereg.norm_split TO authenticated;

-- Dagsfordelingen ud fra den gemte normuge: fridag = 0, arbejdsdag = gået − mødt − frokost (kvarter),
-- ikke sat = kontraktens timer. Gælder fra starten af den aktuelle lønperiode; er den låst eller
-- godkendt for medarbejderen, fra næste. Senere rækker (sat mens perioden var godkendt) følger med.
CREATE OR REPLACE FUNCTION timereg.refresh_norm_split(p_employee_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
DECLARE
  v_contract jsonb;
  v_split jsonb;
  v_period periods%ROWTYPE;
  v_from date;
BEGIN
  SELECT weekly_norm INTO v_contract FROM employees WHERE id = p_employee_id;
  SELECT jsonb_agg(
           CASE WHEN n.day_off THEN 0
                WHEN n.time_in IS NOT NULL THEN
                  GREATEST(0, round((extract(epoch FROM n.time_out - n.time_in) / 60 - n.lunch_min) / 60 * 4) / 4)
                ELSE COALESCE((v_contract->>w)::numeric, 0)
           END ORDER BY w)
    INTO v_split
    FROM generate_series(0, 6) w
    LEFT JOIN norm_week n ON n.employee_id = p_employee_id AND n.weekday = w;

  SELECT * INTO v_period FROM periods WHERE current_date BETWEEN start_date AND end_date;
  IF NOT FOUND THEN
    v_from := current_date;
  ELSIF v_period.locked OR EXISTS (
          SELECT 1 FROM period_approvals pa
           WHERE pa.period_id = v_period.id AND pa.employee_id = p_employee_id
             AND (pa.leader_approved OR pa.economy_approved)) THEN
    v_from := v_period.end_date + 1;
  ELSE
    v_from := v_period.start_date;
  END IF;

  INSERT INTO norm_split (employee_id, valid_from, weekly_norm)
  VALUES (p_employee_id, v_from, v_split)
  ON CONFLICT (employee_id, valid_from) DO UPDATE SET weekly_norm = EXCLUDED.weekly_norm;
  UPDATE norm_split SET weekly_norm = v_split WHERE employee_id = p_employee_id AND valid_from > v_from;
END;
$function$;

REVOKE ALL ON FUNCTION timereg.refresh_norm_split(integer) FROM PUBLIC, anon, authenticated;

-- Gemmer normugen (alle 7 ugedage, upsert) og opdaterer dagsfordelingen.
-- p_days: [{"weekday":0,"time_in":"08:00","time_out":"16:00","lunch_min":30}, {"weekday":3,"day_off":true}, …]
-- Ugedage der ikke er med, er "ikke sat".
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

  INSERT INTO norm_week (employee_id, weekday, time_in, time_out, lunch_min, day_off)
  SELECT p_employee_id, w,
         CASE WHEN COALESCE((d->>'day_off')::boolean, false) THEN NULL ELSE (d->>'time_in')::time END,
         CASE WHEN COALESCE((d->>'day_off')::boolean, false) THEN NULL ELSE (d->>'time_out')::time END,
         COALESCE((d->>'lunch_min')::integer, 30),
         COALESCE((d->>'day_off')::boolean, false)
    FROM generate_series(0, 6) w
    LEFT JOIN jsonb_array_elements(COALESCE(p_days, '[]'::jsonb)) d ON (d->>'weekday')::integer = w
  ON CONFLICT (employee_id, weekday) DO UPDATE
    SET time_in = EXCLUDED.time_in, time_out = EXCLUDED.time_out, lunch_min = EXCLUDED.lunch_min, day_off = EXCLUDED.day_off;

  PERFORM refresh_norm_split(p_employee_id);
END;
$function$;

-- Normuger gemt før i dag får deres dagsfordeling med det samme.
SELECT timereg.refresh_norm_split(employee_id) FROM (SELECT DISTINCT employee_id FROM timereg.norm_week) e;

NOTIFY pgrst, 'reload schema';
