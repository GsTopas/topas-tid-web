-- Fordelingskategori pr. opgavetype (Gorm, 12. nov. 2026). Vælges i Settings → Opgavetyper og vises
-- i Fakturering ved siden af "Opgave". Teksterne svarer til FORDELINGSKATEGORIER i
-- app/src/lib/fordelingskategori.ts. NULL = ingen kategori.
ALTER TABLE timereg.task_types
  ADD COLUMN distribution_category text
  CONSTRAINT task_types_distribution_category_check CHECK (distribution_category IN (
    'Undersøgelse af muligheder',
    '1. Nye driftsmæssige funktionaliteter',
    '2. Konfigurering, tilpasning, opsætning og kodning',
    '3. Integration af cloud-/ERP-udbyderens egne systemer',
    '4. Design, layout, indhold, tekster og billeder',
    '5. Migrering af data og indhold',
    '6. Test af funktioner',
    '7. Træning af medarbejdere',
    '8. Vedligehold og videreførelse af eksisterende funktionalitet',
    '9. Abonnement, licens og hosting'
  ));

-- save_task_type med p_category (ny overload ved siden af den gamle 4-parameter-version, som
-- ældre app-versioner stadig kalder; den rører ikke kategorien). '' = ingen kategori.
CREATE OR REPLACE FUNCTION timereg.save_task_type(p_id integer, p_name text, p_sort integer, p_active boolean, p_category text)
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
                                      ELSE NULLIF(btrim(p_category), '') END
   WHERE id = p_id;
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE allocations a SET task_type = v_new
      FROM employees e
     WHERE e.id = a.employee_id AND e.department = v_dept AND a.task_type = v_old;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION timereg.save_task_type(integer, text, integer, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION timereg.save_task_type(integer, text, integer, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
