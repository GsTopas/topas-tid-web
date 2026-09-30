-- Afdelingsindsigt: fælles projekter. For projekter (companies.kind = 'projekt')
-- som afdelingen selv har timer på i året, må afdelingen se de ANDRE
-- afdelingers timer + beløb, men kun som totaler pr. afdeling og måned:
-- ingen medarbejdernavne, noter eller timepriser. Samme adgangstjek som
-- department_rows, så ingen får adgang til flere afdelinger end i dag.
CREATE OR REPLACE FUNCTION timereg.department_shared_projects(p_year int, p_dept text)
RETURNS TABLE (
  company_id int, comp_name text, department text, month int,
  hours numeric, kr numeric
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
  WITH mine AS (
    SELECT DISTINCT a.company_id
    FROM allocations a
    JOIN employees e ON e.id = a.employee_id
    JOIN companies c ON c.id = a.company_id
    WHERE e.department = p_dept
      AND c.kind = 'projekt'
      AND a.work_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
  )
  SELECT c.id::int, c.name, COALESCE(e.department, '(uden afdeling)'),
         EXTRACT(MONTH FROM a.work_date)::int,
         SUM(a.hours), SUM(a.hours * COALESCE(e.hourly_rate, 0))
  FROM allocations a
  JOIN mine m ON m.company_id = a.company_id
  JOIN employees e ON e.id = a.employee_id
  JOIN companies c ON c.id = a.company_id
  WHERE a.work_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
  GROUP BY c.id, c.name, e.department, EXTRACT(MONTH FROM a.work_date)
  ORDER BY c.name, 3, 4;
END;
$$;

REVOKE EXECUTE ON FUNCTION timereg.department_shared_projects(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION timereg.department_shared_projects(int, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
