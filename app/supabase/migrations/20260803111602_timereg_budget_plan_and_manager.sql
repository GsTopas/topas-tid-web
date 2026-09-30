-- Maanedsplan: lederens forventede timer pr. selskab pr. maaned
CREATE TABLE timereg.budget_plan (
    company_id INT NOT NULL REFERENCES timereg.companies(id),
    department TEXT NOT NULL,
    year       INT NOT NULL,
    month      INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    hours      NUMERIC NOT NULL CHECK (hours >= 0),
    PRIMARY KEY (company_id, department, year, month)
);

-- Afdelingsleder-flag: maa redigere egen afdelings maanedsplan
ALTER TABLE timereg.employees ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT FALSE;
