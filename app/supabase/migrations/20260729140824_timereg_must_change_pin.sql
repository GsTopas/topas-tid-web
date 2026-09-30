-- Tvungent PIN-skift ved foerste login / efter admin-reset
ALTER TABLE timereg.employees ADD COLUMN must_change_pin BOOLEAN NOT NULL DEFAULT FALSE;
