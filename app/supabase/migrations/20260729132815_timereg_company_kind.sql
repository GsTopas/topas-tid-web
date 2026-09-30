-- Skelnen mellem selskaber (drift) og projekter (skal fordeles ud via regler)
ALTER TABLE timereg.companies ADD COLUMN kind TEXT NOT NULL DEFAULT 'selskab';
UPDATE timereg.companies SET kind = 'projekt' WHERE name ILIKE 'projekt%';
