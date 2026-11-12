-- Opgavestyring pr. medarbejder: om personen skriver ned, hvad de har arbejdet med (Timefordeling på
-- selskaber/projekter). Uden opgavestyring = enkel visning (kun mødt/gået, fravær og ferie; ingen
-- viderefakturering). Erstatter reglen om, at hele afdelingen Topas Travel har enkel visning (Gorm, 12. nov. 2026).
-- Startværdi: alle har opgavestyring undtagen dem i afdelingen Topas Travel.
ALTER TABLE timereg.employees
  ADD COLUMN task_tracking boolean NOT NULL DEFAULT true;

UPDATE timereg.employees SET task_tracking = false WHERE department = 'Topas Travel';

GRANT SELECT (task_tracking), UPDATE (task_tracking), INSERT (task_tracking)
  ON timereg.employees TO authenticated;

NOTIFY pgrst, 'reload schema';
