-- Startdato pr. medarbejder: dage før denne tæller ikke som "mangler".
-- NULL = ansat før systemet (ingen begrænsning).
ALTER TABLE timereg.employees ADD COLUMN hired_date date;

GRANT SELECT (hired_date), UPDATE (hired_date), INSERT (hired_date)
  ON timereg.employees TO authenticated;

NOTIFY pgrst, 'reload schema';
