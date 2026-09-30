-- Tillad flere fordelings-linjer paa samme projekt+opgavetype pr. dag
-- (fx to TEG/Moede-linjer med hver sin opgavenote). Al skrivning sker som
-- slet-og-genindsaet pr. dag, saa unikheds-vaernet er ikke laengere noedvendigt.
ALTER TABLE timereg.allocations DROP CONSTRAINT allocations_uniq;
CREATE INDEX idx_allocations_emp_date ON timereg.allocations (employee_id, work_date);
