-- Gorm valgte 7.10.2026: IT-linjer med den udgåede opgavetype "Udvikling/test/release" flyttes til "Produktudvikling".
UPDATE timereg.allocations a SET task_type = 'Produktudvikling'
  FROM timereg.employees e
 WHERE e.id = a.employee_id AND e.department = 'IT' AND a.task_type = 'Udvikling/test/release';
