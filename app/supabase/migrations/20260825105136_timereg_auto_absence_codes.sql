-- Lønkoder sættes automatisk i databasen — undtagen Ferie (2200/2300)
-- og Egen sygdom (10/13), som økonomi vurderer manuelt.
CREATE OR REPLACE FUNCTION timereg.auto_absence_code() RETURNS trigger
LANGUAGE plpgsql SET search_path = timereg AS
$$
BEGIN
  IF NEW.absence_type = 'Barn syg' THEN
    NEW.absence_code := '20';
  ELSIF NEW.absence_type = 'Øvrigt fravær' AND NEW.absence_code IS NULL THEN
    NEW.absence_code := '50'; -- firmabetalt er standard; 51 sættes eksplicit af appen
  ELSIF NEW.absence_type IS NULL THEN
    NEW.absence_code := NULL;
    NEW.absence_choice := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_auto_absence_code
BEFORE INSERT OR UPDATE OF absence_type, absence_code ON timereg.day_entries
FOR EACH ROW EXECUTE FUNCTION timereg.auto_absence_code();

-- Backfill af eksisterende registreringer
UPDATE timereg.day_entries SET absence_code = '20'
WHERE absence_type = 'Barn syg' AND absence_code IS DISTINCT FROM '20';
UPDATE timereg.day_entries SET absence_code = '50'
WHERE absence_type = 'Øvrigt fravær' AND absence_code IS NULL;
