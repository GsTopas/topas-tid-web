-- Fase 1b: SQL-grants til API-rollerne. RLS-policies afgør stadig
-- hvilke RÆKKER der kan ses/ændres — grants åbner kun tabellerne.
GRANT USAGE ON SCHEMA timereg TO authenticated, anon, service_role;

-- authenticated: CRUD (RLS begrænser til egne rækker + ulåste perioder)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA timereg TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA timereg TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA timereg TO authenticated;

-- anon (ikke logget ind): INGEN tabel-adgang overhovedet
-- service_role (Edge Functions): fuld adgang, omgår RLS
GRANT ALL ON ALL TABLES IN SCHEMA timereg TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA timereg TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA timereg TO service_role;

-- Fremtidige tabeller får samme rettigheder automatisk
ALTER DEFAULT PRIVILEGES IN SCHEMA timereg
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA timereg
  GRANT ALL ON TABLES TO service_role;

-- Eksponér timereg-skemaet for Supabase's REST-lag (supabase-js)
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, timereg';
NOTIFY pgrst, 'reload config';
