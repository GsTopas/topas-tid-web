-- Timepris pr. medarbejder (DKK) — bruges til beløb ved viderefakturering
ALTER TABLE timereg.employees ADD COLUMN hourly_rate NUMERIC NOT NULL DEFAULT 0;
