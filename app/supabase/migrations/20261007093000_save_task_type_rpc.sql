-- Omdøbning af en opgavetype skal også omdøbe eksisterende timelinjer.
-- allocations.task_type gemmer navnet (tekst), så et nyt navn fik gamle linjer
-- til at stå blanke i Min tid. Rettelse + omdøbning sker i én transaktion.
CREATE OR REPLACE FUNCTION timereg.save_task_type(p_id integer, p_name text, p_sort integer, p_active boolean)
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
  UPDATE task_types SET name = v_new, sort = COALESCE(p_sort, 0), active = COALESCE(p_active, true) WHERE id = p_id;
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE allocations a SET task_type = v_new
      FROM employees e
     WHERE e.id = a.employee_id AND e.department = v_dept AND a.task_type = v_old;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION timereg.save_task_type(integer, text, integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION timereg.save_task_type(integer, text, integer, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
