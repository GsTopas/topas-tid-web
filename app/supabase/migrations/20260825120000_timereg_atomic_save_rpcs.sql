-- Recovered 2026-09-30 from the live database (pg_get_functiondef).
-- These two RPCs exist in Supabase project bymurhqfcyxdhrayddoz but are NOT
-- recorded in supabase_migrations (they were created by hand around 2026-08-25).
-- Save them as a migration in the new source repo so the backend is reproducible.

CREATE OR REPLACE FUNCTION timereg.save_billing_rules(p_source_company_id integer, p_rules jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  IF NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan ændre fordelingsregler';
  END IF;
  DELETE FROM billing_rules WHERE source_company_id = p_source_company_id;
  INSERT INTO billing_rules (source_company_id, target_company_id, share, active)
  SELECT p_source_company_id,
         (r->>'target_company_id')::integer,
         (r->>'share')::numeric,
         true
    FROM jsonb_array_elements(COALESCE(p_rules, '[]'::jsonb)) AS r;
END $function$;

CREATE OR REPLACE FUNCTION timereg.save_employee_access(p_employee_id integer, p_company_ids jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  IF NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan ændre selskabs-adgange';
  END IF;
  DELETE FROM employee_companies WHERE employee_id = p_employee_id;
  INSERT INTO employee_companies (employee_id, company_id)
  SELECT p_employee_id, c::integer
    FROM jsonb_array_elements_text(COALESCE(p_company_ids, '[]'::jsonb)) AS c;
END $function$;
