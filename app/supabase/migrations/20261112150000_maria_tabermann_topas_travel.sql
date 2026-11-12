-- Maria Tabermann flyttes fra Økonomi til Topas Travel, som den eneste i Topas Travel med opgavestyring
-- (Gorm, 12. nov. 2026). Køres først, når appen med fluebenet "Opgavestyring" er live; ellers ville den
-- gamle app give hende enkel visning ud fra afdelingen.
UPDATE timereg.employees
   SET department = 'Topas Travel', task_tracking = true
 WHERE name LIKE 'Maria Tabermann%' AND department = 'Økonomi';
