-- "Ansat i selskab": hvilket selskab (companies.kind = 'selskab') medarbejderen er ansat i.
-- Kun til visning/sortering i Settings → Medarbejdere; påvirker ikke fakturering.
-- NULL = ikke angivet.
ALTER TABLE timereg.employees
  ADD COLUMN employer_company_id integer REFERENCES timereg.companies(id) ON DELETE SET NULL;

GRANT SELECT (employer_company_id), UPDATE (employer_company_id), INSERT (employer_company_id)
  ON timereg.employees TO authenticated;

NOTIFY pgrst, 'reload schema';
