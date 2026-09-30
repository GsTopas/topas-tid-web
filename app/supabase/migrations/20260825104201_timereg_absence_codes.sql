-- Lønkoder til fraværsudtrækket (fra 'Kopi af data tidsreg. TEG.xlsx')
CREATE TABLE timereg.absence_codes (
  code text PRIMARY KEY,
  label text NOT NULL,
  source text NOT NULL CHECK (source IN ('system', 'medarbejder', 'oekonomi')),
  sort int NOT NULL DEFAULT 0
);
INSERT INTO timereg.absence_codes (code, label, source, sort) VALUES
  ('1',    'Rejsedage med overnatning',      'oekonomi',    10),
  ('10',   'Egen sygdom',                    'oekonomi',    20),
  ('13',   '§ 56 Sygdom',                    'oekonomi',    30),
  ('20',   'Børns sygdom',                   'system',      40),
  ('2200', 'Optjent Ferie afholdt',          'oekonomi',    50),
  ('2300', 'Optjente Feriefridage afholdt',  'oekonomi',    60),
  ('40',   'Graviditet, fødsel og orlov',    'oekonomi',    70),
  ('50',   'Andet fravær – firmabetalt',     'medarbejder', 80),
  ('51',   'Andet fravær – egen betalt',     'medarbejder', 90),
  ('90',   'Afspadsering',                   'oekonomi',   100);
ALTER TABLE timereg.absence_codes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON timereg.absence_codes TO authenticated;
CREATE POLICY ac_select ON timereg.absence_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY ac_admin ON timereg.absence_codes FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());

-- De 12 valgmuligheder under kode 50 (firmabetalt andet fravær)
CREATE TABLE timereg.andet_fravaer_valg (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0
);
INSERT INTO timereg.andet_fravaer_valg (label, sort) VALUES
  ('Lægebesøg – egen', 10),
  ('Lægebesøg – hjemmeboende barn', 20),
  ('Tandlægebesøg – egen', 30),
  ('Tandlægebesøg – hjemmeboende barn', 40),
  ('Fysioterapeut', 50),
  ('Kiropraktor', 60),
  ('Psykolog', 70),
  ('Hospitalsindlæggelse', 80),
  ('Undersøgelse', 90),
  ('Flyttefri', 100),
  ('Bryllupsfri', 110),
  ('Begravelsesfri', 120);
ALTER TABLE timereg.andet_fravaer_valg ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON timereg.andet_fravaer_valg TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA timereg TO authenticated;
CREATE POLICY afv_select ON timereg.andet_fravaer_valg FOR SELECT TO authenticated USING (true);
CREATE POLICY afv_admin ON timereg.andet_fravaer_valg FOR ALL TO authenticated
  USING (timereg.me_is_admin()) WITH CHECK (timereg.me_is_admin());

-- Lønkode + valgt mulighed på dagsregistreringen
ALTER TABLE timereg.day_entries ADD COLUMN absence_code text REFERENCES timereg.absence_codes(code);
ALTER TABLE timereg.day_entries ADD COLUMN absence_choice text;

-- Økonomi kan kode fravær — OGSÅ efter perioden er godkendt/låst
CREATE OR REPLACE FUNCTION timereg.set_absence_code(p_emp int, p_date date, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = timereg AS
$$
BEGIN
  IF NOT me_is_economy() THEN
    RAISE EXCEPTION 'Kun økonomi/admin kan sætte lønkoder';
  END IF;
  UPDATE day_entries SET absence_code = NULLIF(p_code, '')
  WHERE employee_id = p_emp AND work_date = p_date;
END $$;
GRANT EXECUTE ON FUNCTION timereg.set_absence_code(int, date, text) TO authenticated;

-- Lessor-medarbejdernumre (fra medarbejder-arket)
ALTER TABLE timereg.employees ADD COLUMN payroll_number int;
GRANT SELECT (payroll_number), UPDATE (payroll_number), INSERT (payroll_number)
  ON timereg.employees TO authenticated;
UPDATE timereg.employees SET payroll_number = 10003 WHERE name ILIKE 'Lone%Ebbesen';
UPDATE timereg.employees SET payroll_number = 10004 WHERE name ILIKE 'Malene%Poulsen';
UPDATE timereg.employees SET payroll_number = 10012 WHERE name ILIKE 'Nikoline%Kaalund';
UPDATE timereg.employees SET payroll_number = 10017 WHERE name ILIKE 'Daniel%Johnsen';
UPDATE timereg.employees SET payroll_number = 10028 WHERE name ILIKE 'Morten%Kusk';
UPDATE timereg.employees SET payroll_number = 10033 WHERE name ILIKE 'Anne Schultz%';
UPDATE timereg.employees SET payroll_number = 10038 WHERE name ILIKE 'Gorm%Nielsen';

NOTIFY pgrst, 'reload schema';
