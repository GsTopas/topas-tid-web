-- Timepuljer: virksomheder der har koebt X timer af en afdeling,
-- enten pr. aar eller pr. maaned. Styres i Admin -> Timepuljer.
CREATE TABLE timereg.hour_budgets (
    id          SERIAL PRIMARY KEY,
    company_id  INT NOT NULL REFERENCES timereg.companies(id),
    department  TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('year', 'month')),
    hours       NUMERIC NOT NULL CHECK (hours > 0),
    year        INT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (company_id, department, year)
);
