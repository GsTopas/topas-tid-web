-- Fuld indsigt (alle afdelingers timer/loen/fakturering) kun for admin og LEDER i Oekonomi.
-- Foer gav blot det at sidde i Oekonomi-afdelingen fuld adgang. Bruges af RLS-policies:
-- al_select, de_select, emp_select, br_select, ec_select, pa_select, per_lock.
CREATE OR REPLACE FUNCTION timereg.me_is_economy()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$ SELECT COALESCE((SELECT is_admin OR (department = 'Økonomi' AND is_manager) FROM employees
   WHERE auth_user_id = auth.uid() AND active), false) $function$;
