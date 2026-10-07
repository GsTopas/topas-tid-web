-- Engangsoprydning (godkendt af Gorm 7.10.2026): timelinjer hvis opgavetype-navn
-- ikke længere fandtes efter tidligere omdøbninger. "Udvikling/test/release" (IT)
-- og "Div" (Digital Transformation) er bevidst ikke rørt.
UPDATE timereg.task_types SET name = 'Møde' WHERE id = 121 AND department = 'Marketing' AND name = 'Møde ';

UPDATE timereg.allocations a SET task_type = m.new_name
  FROM timereg.employees e,
       (VALUES ('Marketing', 'Møde el. koordinering', 'Møde'),
               ('IT', 'test.', 'test'),
               ('Digital Transformation', 'Lønsystem & Viderefakturering', 'Tidsregistrering & Viderefakturering')
       ) AS m(dept, old_name, new_name)
 WHERE e.id = a.employee_id AND e.department = m.dept AND a.task_type = m.old_name;
