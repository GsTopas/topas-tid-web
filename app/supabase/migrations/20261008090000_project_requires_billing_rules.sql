-- Selskaber og projekter er delt op i to faner. Et projekt er enten
-- "Projekt (Løbende pr. måned)" (billing_type 'loebende') eller
-- "Projekt (Samlet til afslutning)" (billing_type 'samlet').
-- Et løbende projekt skal have fordelingsnøgler (billing_rules) for at kunne gemmes.
--
-- Håndhæves med udskudte constraint-triggere, så et nyt projekt og dets nøgler
-- kan gemmes i samme transaktion (save_project), og så en sletning af alle nøgler
-- på et løbende projekt (save_billing_rules) afvises. Tjekket kører kun, når et
-- løbende projekt oprettes/ændres eller dets nøgler ændres; eksisterende rækker røres ikke.

CREATE OR REPLACE FUNCTION timereg.assert_loebende_has_rules(p_company_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM companies
   WHERE id = p_company_id AND kind = 'projekt' AND billing_type = 'loebende';
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM billing_rules
                  WHERE source_company_id = p_company_id AND active AND share > 0) THEN
    RAISE EXCEPTION 'Projektet "%" er løbende pr. måned og skal have fordelingsnøgler', v_name;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION timereg.trg_company_loebende_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  PERFORM assert_loebende_has_rules(NEW.id);
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION timereg.trg_rules_loebende_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
BEGIN
  PERFORM assert_loebende_has_rules(OLD.source_company_id);
  RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION timereg.assert_loebende_has_rules(integer) FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_company_loebende_rules ON timereg.companies;
CREATE CONSTRAINT TRIGGER trg_company_loebende_rules
  AFTER INSERT OR UPDATE ON timereg.companies
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.kind = 'projekt' AND NEW.billing_type = 'loebende')
  EXECUTE FUNCTION timereg.trg_company_loebende_rules();

DROP TRIGGER IF EXISTS trg_rules_loebende_rules ON timereg.billing_rules;
CREATE CONSTRAINT TRIGGER trg_rules_loebende_rules
  AFTER DELETE OR UPDATE ON timereg.billing_rules
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION timereg.trg_rules_loebende_rules();

-- Opret/ret et projekt og (valgfrit) dets fordelingsnøgler i én transaktion.
-- p_rules = NULL: nøglerne røres ikke. Ellers erstattes de (som save_billing_rules).
-- Ledere må rette projekter (som før via comp_mgr); kun admin må ændre nøgler.
CREATE OR REPLACE FUNCTION timereg.save_project(
  p_id integer,
  p_name text,
  p_billing_type text,
  p_expected_settlement date,
  p_active boolean,
  p_sort integer,
  p_rules jsonb
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'timereg'
AS $function$
DECLARE
  v_id integer := p_id;
  v_name text := btrim(COALESCE(p_name, ''));
  v_sum numeric;
BEGIN
  IF NOT (me_is_admin() OR me_is_manager()) THEN
    RAISE EXCEPTION 'Kun ledere og admin kan ændre projekter';
  END IF;
  IF p_rules IS NOT NULL AND NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admin kan ændre fordelingsnøgler';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Projektet skal have et navn';
  END IF;
  IF p_billing_type NOT IN ('loebende', 'samlet') THEN
    RAISE EXCEPTION 'Ukendt projekttype: %', p_billing_type;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO companies (name, kind, billing_type, expected_settlement, active, sort)
    VALUES (v_name, 'projekt', p_billing_type,
            CASE WHEN p_billing_type = 'samlet' THEN p_expected_settlement END,
            COALESCE(p_active, true), COALESCE(p_sort, 99))
    RETURNING id INTO v_id;
  ELSE
    UPDATE companies
       SET name = v_name,
           kind = 'projekt',
           billing_type = p_billing_type,
           expected_settlement = CASE WHEN p_billing_type = 'samlet' THEN p_expected_settlement END,
           active = COALESCE(p_active, true),
           sort = COALESCE(p_sort, 0)
     WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Projektet findes ikke';
    END IF;
  END IF;

  IF p_rules IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rules) r
                LEFT JOIN companies c ON c.id = (r->>'target_company_id')::integer
                WHERE c.id IS NULL OR c.kind <> 'selskab') THEN
      RAISE EXCEPTION 'Fordelingsnøgler kan kun pege på selskaber';
    END IF;
    SELECT COALESCE(sum((r->>'share')::numeric), 0) INTO v_sum FROM jsonb_array_elements(p_rules) r;
    IF v_sum > 1.0001 THEN
      RAISE EXCEPTION 'Fordelingsnøglerne må højst summe til 100 %%';
    END IF;
    DELETE FROM billing_rules WHERE source_company_id = v_id;
    INSERT INTO billing_rules (source_company_id, target_company_id, share, active)
    SELECT v_id, (r->>'target_company_id')::integer, (r->>'share')::numeric, true
      FROM jsonb_array_elements(p_rules) r
     WHERE (r->>'share')::numeric > 0;
  END IF;

  RETURN v_id;
END $function$;

REVOKE ALL ON FUNCTION timereg.save_project(integer, text, text, date, boolean, integer, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION timereg.save_project(integer, text, text, date, boolean, integer, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
