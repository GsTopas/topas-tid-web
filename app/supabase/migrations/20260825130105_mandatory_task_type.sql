-- Opgavetype er obligatorisk på timelinjer — undtagen for Hotel & Administration
-- og for afdelinger helt uden aktive opgavetyper (dér vises kolonnen slet ikke).
-- Gælder kun nye/ændrede rækker; historiske rækker uden opgavetype røres ikke.
CREATE OR REPLACE FUNCTION timereg.enforce_task_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'timereg'
AS $$
DECLARE dept text;
BEGIN
  IF NEW.task_type IS NULL OR btrim(NEW.task_type) = '' THEN
    SELECT department INTO dept FROM employees WHERE id = NEW.employee_id;
    IF COALESCE(dept, '') <> 'Hotel & Administration'
       AND EXISTS (SELECT 1 FROM task_types t WHERE t.department = dept AND t.active) THEN
      RAISE EXCEPTION 'Opgavetype er obligatorisk — vælg en opgavetype på timelinjen';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_task_type ON timereg.allocations;
CREATE TRIGGER trg_enforce_task_type
  BEFORE INSERT OR UPDATE ON timereg.allocations
  FOR EACH ROW EXECUTE FUNCTION timereg.enforce_task_type();
