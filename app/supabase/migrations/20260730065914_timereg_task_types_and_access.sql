-- Opgavetyper pr. afdeling (betinget dropdown i timefordelingen)
CREATE TABLE timereg.task_types (
    id         SERIAL PRIMARY KEY,
    department TEXT NOT NULL,
    name       TEXT NOT NULL,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    sort       INT NOT NULL DEFAULT 100,
    UNIQUE (department, name)
);

INSERT INTO timereg.task_types (department, name, sort) VALUES
('Marketing', 'Offline materiale', 10),
('Marketing', 'SoMe', 20),
('Marketing', 'Website - content og UX', 30),
('Marketing', 'Website - produktopdateringer', 40),
('Marketing', 'Nyhedsbrev', 50),
('Marketing', 'Møde el. koordinering', 60),
('Marketing', 'Annoncering', 70),
('Marketing', 'Rapportering og data', 80),
('Marketing', 'Events og foredrag', 90),
('IT', 'Spectra', 10),
('IT', 'Betaling (Nets m.fl.)', 20),
('IT', 'Custom udvikling', 30),
('IT', 'API', 40),
('IT', 'Business Intelligence', 50);

-- Opgavetype paa timefordelinger ('' = ingen). NOT NULL saa unique-constraint
-- og ON CONFLICT fungerer simpelt.
ALTER TABLE timereg.allocations ADD COLUMN task_type TEXT NOT NULL DEFAULT '';
ALTER TABLE timereg.allocations DROP CONSTRAINT allocations_employee_id_work_date_company_id_key;
ALTER TABLE timereg.allocations ADD CONSTRAINT allocations_uniq
    UNIQUE (employee_id, work_date, company_id, task_type);

-- Hvilke projekter/selskaber arbejder medarbejderen under (tom = alle)
CREATE TABLE timereg.employee_companies (
    employee_id INT NOT NULL REFERENCES timereg.employees(id),
    company_id  INT NOT NULL REFERENCES timereg.companies(id),
    PRIMARY KEY (employee_id, company_id)
);
