-- Opgavetype kan også være "begge" (både projekt- og driftsopgave; Gorm, 17. nov. 2026):
-- vises under både projekter og selskaber i Min tid (lib/opgaveart.ts).
ALTER TABLE timereg.task_types DROP CONSTRAINT task_types_task_kind_check;
ALTER TABLE timereg.task_types
  ADD CONSTRAINT task_types_task_kind_check CHECK (task_kind IN ('projekt', 'drift', 'begge'));

NOTIFY pgrst, 'reload schema';
