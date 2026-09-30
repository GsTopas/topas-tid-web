-- Afregningstype for projekter:
--   'loebende' = faktureres pr. måned som drift (standard, nuværende adfærd)
--   'samlet'   = akkumuleres og faktureres først når projektet afsluttes
ALTER TABLE timereg.companies
  ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'loebende'
  CHECK (billing_type IN ('loebende', 'samlet'));

NOTIFY pgrst, 'reload schema';
