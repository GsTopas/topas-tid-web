-- Forventet afregningsdato for projekter med samlet afregning
ALTER TABLE timereg.companies ADD COLUMN expected_settlement date;
NOTIFY pgrst, 'reload schema';
