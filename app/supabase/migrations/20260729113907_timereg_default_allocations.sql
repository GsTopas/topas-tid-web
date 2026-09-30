-- Personlig standardfordeling: bruges til auto-udfyld af timefordeling
CREATE TABLE timereg.default_allocations (
    employee_id INT NOT NULL REFERENCES timereg.employees(id),
    company_id  INT NOT NULL REFERENCES timereg.companies(id),
    share       NUMERIC NOT NULL CHECK (share > 0 AND share <= 1),
    PRIMARY KEY (employee_id, company_id)
);
