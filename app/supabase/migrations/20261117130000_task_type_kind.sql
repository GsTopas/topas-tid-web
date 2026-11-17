-- Projekt- eller driftsopgave pr. opgavetype (Gorm, 17. nov. 2026). Vælges i Settings → Opgavetyper,
-- og Min tid grupperer valget af opgavetype i "Projektopgaver" og "Driftsopgaver".
-- NULL = ikke angivet (vises under "Øvrige" i Min tid, når afdelingen har andre typer angivet).
ALTER TABLE timereg.task_types
  ADD COLUMN task_kind text
  CONSTRAINT task_types_task_kind_check CHECK (task_kind IN ('projekt', 'drift'));

-- save_task_type med p_kind (ny overload ved siden af de ældre versioner, som ældre app-versioner
-- stadig kalder; de rører ikke task_kind). p_kind: NULL = behold, '' = ikke angivet.
CREATE OR REPLACE FUNCTION timereg.save_task_type(p_id integer, p_name text, p_sort integer, p_active boolean, p_category text, p_kind text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
DECLARE
  v_dept text;
  v_old text;
  v_new text := btrim(COALESCE(p_name, ''));
BEGIN
  SELECT department, name INTO v_dept, v_old FROM task_types WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opgavetypen findes ikke';
  END IF;
  IF NOT (me_is_admin() OR (me_is_manager() AND v_dept = me_department())) THEN
    RAISE EXCEPTION 'Du kan kun ændre opgavetyper for din egen afdeling';
  END IF;
  IF v_new = '' THEN
    RAISE EXCEPTION 'Opgavetypen skal have et navn';
  END IF;
  UPDATE task_types
     SET name = v_new,
         sort = COALESCE(p_sort, 0),
         active = COALESCE(p_active, true),
         distribution_category = CASE WHEN p_category IS NULL THEN distribution_category
                                      ELSE NULLIF(btrim(p_category), '') END,
         task_kind = CASE WHEN p_kind IS NULL THEN task_kind
                          ELSE NULLIF(btrim(p_kind), '') END
   WHERE id = p_id;
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE allocations a SET task_type = v_new
      FROM employees e
     WHERE e.id = a.employee_id AND e.department = v_dept AND a.task_type = v_old;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION timereg.save_task_type(integer, text, integer, boolean, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION timereg.save_task_type(integer, text, integer, boolean, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
