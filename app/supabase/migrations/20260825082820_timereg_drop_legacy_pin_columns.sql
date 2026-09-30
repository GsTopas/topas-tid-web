-- Streamlit-udgaven er pensioneret (2026-08-25); dens PIN-login-kolonner
-- fjernes. Auth kører udelukkende via Supabase Auth (auth_user_id).
ALTER TABLE timereg.employees DROP COLUMN pin;
ALTER TABLE timereg.employees DROP COLUMN session_token;
ALTER TABLE timereg.employees DROP COLUMN failed_logins;
ALTER TABLE timereg.employees DROP COLUMN locked_until;
ALTER TABLE timereg.employees DROP COLUMN must_change_pin;
NOTIFY pgrst, 'reload schema';
