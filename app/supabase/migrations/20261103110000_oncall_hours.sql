-- Vagttelefon (Topas Travel): timer på vagttelefonen en given dag. Vises i en separat kolonne
-- (tæller ikke med i Kontrol / ÅTD saldo / Flex) og kan også registreres på en dag uden arbejde
-- ("Ingen", fx en søndag): så gemmes en day_entries-række uden location og absence_type.
-- day_entries har tabel-grants og RLS (låse, leder-/økonomigodkendelse) gælder også for kolonnen.
ALTER TABLE timereg.day_entries
  ADD COLUMN IF NOT EXISTS oncall_hours numeric
  CONSTRAINT day_entries_oncall_hours_range CHECK (oncall_hours IS NULL OR (oncall_hours >= 0 AND oncall_hours <= 24));

COMMENT ON COLUMN timereg.day_entries.oncall_hours IS 'Vagttelefon-timer på dagen (vises separat, tæller ikke i saldo). NULL = ingen.';

NOTIFY pgrst, 'reload schema';
