-- Min afdeling under RLS: medlemmer må se afdelingens AGGREGERBARE data
-- (timer + beløb), men ikke kollegers rå timepriser. SECURITY DEFINER
-- med eget adgangstjek: kalderen skal være i afdelingen, økonomi eller admin.
CREATE OR REPLACE FUNCTION timereg.department_rows(p_year int, p_dept text)
RETURNS TABLE (
  work_date date, hours numeric, task_type text, task_note text,
  emp_name text, comp_name text, kr numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = timereg AS
$$
DECLARE me employees%ROWTYPE;
BEGIN
  SELECT * INTO me FROM employees
  WHERE auth_user_id = auth.uid() AND active;
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind som aktiv medarbejder';
  END IF;
  IF NOT (me.is_admin OR me.department = 'Økonomi' OR me.department = p_dept) THEN
    RAISE EXCEPTION 'Du har ikke adgang til afdelingen %', p_dept;
  END IF;

  RETURN QUERY
  SELECT a.work_date::date, a.hours, a.task_type, a.task_note,
         e.name, c.name, a.hours * COALESCE(e.hourly_rate, 0)
  FROM allocations a
  JOIN employees e ON e.id = a.employee_id
  JOIN companies c ON c.id = a.company_id
  WHERE e.department = p_dept
    AND a.work_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
  ORDER BY a.work_date;
END;
$$;

GRANT EXECUTE ON FUNCTION timereg.department_rows(int, text) TO authenticated;

-- Fremtidige funktioner i skemaet skal også kunne kaldes af loggede ind
ALTER DEFAULT PRIVILEGES IN SCHEMA timereg
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

NOTIFY pgrst, 'reload schema';
