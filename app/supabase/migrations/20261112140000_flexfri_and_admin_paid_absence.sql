-- Fraværstyper (Gorm, 12 Nov 2026)
-- 1) Kode 51 hedder nu "Andet fravær - flexfri eller lign.". Den tæller ikke som fravær i appen,
--    men trækkes fra i Kontrol/ÅTD saldo/Flex (beregnes i frontend; ingen dataændring på dagene).
-- 2) "Andet firma betalt fravær" = Øvrigt fravær, kode 50, absence_choice = 'Andet firma betalt fravær'
--    og fritekst i absence_note. Kun admins må sætte den; en dag der allerede har den kan gemmes igen
--    af andre (fx medarbejderen der retter mødetid), så længe valget ikke ændres.

UPDATE timereg.absence_codes
SET label = 'Andet fravær – flexfri eller lign.'
WHERE code = '51';

CREATE OR REPLACE FUNCTION timereg.guard_admin_paid_absence() RETURNS trigger
LANGUAGE plpgsql SET search_path = timereg AS
$$
BEGIN
  IF NEW.absence_choice = 'Andet firma betalt fravær'
     AND (TG_OP = 'INSERT' OR OLD.absence_choice IS DISTINCT FROM NEW.absence_choice)
     AND NOT me_is_admin() THEN
    RAISE EXCEPTION 'Kun admins kan registrere "Andet firma betalt fravær"';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_admin_paid_absence ON timereg.day_entries;
CREATE TRIGGER trg_guard_admin_paid_absence
BEFORE INSERT OR UPDATE OF absence_choice ON timereg.day_entries
FOR EACH ROW EXECUTE FUNCTION timereg.guard_admin_paid_absence();

NOTIFY pgrst, 'reload schema';
