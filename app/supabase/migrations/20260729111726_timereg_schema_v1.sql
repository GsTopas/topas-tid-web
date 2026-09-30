-- Timeregistrering: separat skema så det er helt adskilt fra scraper-tabellerne
CREATE SCHEMA IF NOT EXISTS timereg;

-- Medarbejdere. weekly_norm = normtimer man-søn (jeres mønster: 7.5 man-tor, 7 fre)
CREATE TABLE timereg.employees (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    email       TEXT,
    pin         TEXT NOT NULL DEFAULT '0000',
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    weekly_norm JSONB NOT NULL DEFAULT '[7.5, 7.5, 7.5, 7.5, 7.0, 0, 0]',
    flex_start  NUMERIC NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lønperioder (følger IKKE kalendermåneden — fx JULI = 22.06-26.07)
CREATE TABLE timereg.periods (
    id         SERIAL PRIMARY KEY,
    year       INT NOT NULL,
    month_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date   DATE NOT NULL,
    locked     BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (year, month_name)
);

-- Selskaber/projekter der kan fordeles timer til
CREATE TABLE timereg.companies (
    id     SERIAL PRIMARY KEY,
    name   TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort   INT NOT NULL DEFAULT 100
);

-- Én række pr. medarbejder pr. dag
CREATE TABLE timereg.day_entries (
    id            SERIAL PRIMARY KEY,
    employee_id   INT NOT NULL REFERENCES timereg.employees(id),
    work_date     DATE NOT NULL,
    location      TEXT,            -- 'Kontor' | 'Andet sted' | NULL (ikke arbejdsdag)
    location_note TEXT,            -- 'skriv hvor' ved Andet sted
    absence_type  TEXT,            -- 'Ferie' | 'Egen sygdom' | 'Barn syg' | 'Øvrigt fravær' | NULL
    absence_note  TEXT,            -- 'skriv hvilken slags' ved Øvrigt fravær
    absence_hours NUMERIC,         -- timeantal ved sygdom/barn syg/øvrigt
    time_in       TIME,
    time_out      TIME,
    work_hours    NUMERIC,         -- faktisk arbejdstid (ekskl. frokost)
    note          TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, work_date)
);

-- Timefordeling til selskaber (viderefakturering) — én række pr. dag pr. selskab
CREATE TABLE timereg.allocations (
    id          SERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES timereg.employees(id),
    work_date   DATE NOT NULL,
    company_id  INT NOT NULL REFERENCES timereg.companies(id),
    hours       NUMERIC NOT NULL,
    UNIQUE (employee_id, work_date, company_id)
);

-- Fordelingsregler: timer på source-selskab faktureres videre til targets efter share
-- Fx Projekt GL -> 1/3 Topas Travel, 1/3 Hotel Icefiord, 1/3 Disko Line
CREATE TABLE timereg.billing_rules (
    id                SERIAL PRIMARY KEY,
    source_company_id INT NOT NULL REFERENCES timereg.companies(id),
    target_company_id INT NOT NULL REFERENCES timereg.companies(id),
    share             NUMERIC NOT NULL CHECK (share > 0 AND share <= 1),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (source_company_id, target_company_id)
);

CREATE INDEX idx_day_entries_date ON timereg.day_entries(work_date);
CREATE INDEX idx_allocations_date ON timereg.allocations(work_date);
CREATE INDEX idx_allocations_company ON timereg.allocations(company_id);

-- Seed: lønperioder 2026 (fra Månedsoversigt 2026)
INSERT INTO timereg.periods (year, month_name, start_date, end_date) VALUES
(2026, 'Januar',    '2026-01-01', '2026-01-25'),
(2026, 'Februar',   '2026-01-26', '2026-02-22'),
(2026, 'Marts',     '2026-02-23', '2026-03-22'),
(2026, 'April',     '2026-03-23', '2026-04-26'),
(2026, 'Maj',       '2026-04-27', '2026-05-24'),
(2026, 'Juni',      '2026-05-25', '2026-06-21'),
(2026, 'Juli',      '2026-06-22', '2026-07-26'),
(2026, 'August',    '2026-07-27', '2026-08-23'),
(2026, 'September', '2026-08-24', '2026-09-27'),
(2026, 'Oktober',   '2026-09-28', '2026-10-25'),
(2026, 'November',  '2026-10-26', '2026-11-22'),
(2026, 'December',  '2026-11-23', '2026-12-31');

-- Seed: selskaber (kolonnerne fra timesedlen)
INSERT INTO timereg.companies (name, sort) VALUES
('Disko Line', 10),
('BIE tur operatør', 20),
('BIE Igaliku', 30),
('Hotel Icefiord', 40),
('Hotel Disko Island', 50),
('Hotel Disko Bay', 60),
('Hotel Qaqortoq', 70),
('Topas Travel', 80),
('TEG', 90),
('TEG / Ferry O.', 100),
('TAV', 110),
('TEL', 120),
('Nuuk Water Taxi', 130),
('Sølvsten JN', 140),
('Projekt GL', 150),
('Projekt (IT) Booking system', 160);

-- Seed: fordelingsregel Projekt GL -> 1/3 Topas, 1/3 Hotel Icefiord, 1/3 Disko Line
INSERT INTO timereg.billing_rules (source_company_id, target_company_id, share)
SELECT s.id, t.id, 1.0/3
FROM timereg.companies s, timereg.companies t
WHERE s.name = 'Projekt GL' AND t.name IN ('Topas Travel', 'Hotel Icefiord', 'Disko Line');

-- Seed: Gorm som admin (PIN skiftes i appen)
INSERT INTO timereg.employees (name, email, pin, is_admin) VALUES
('Gorm Sølvsten Nielsen', 'gs@topas.dk', '1234', TRUE);
