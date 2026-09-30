-- Bremse på login-forsøg: 5 fejl i træk låser kontoen i 2 minutter
ALTER TABLE timereg.employees ADD COLUMN failed_logins INT NOT NULL DEFAULT 0;
ALTER TABLE timereg.employees ADD COLUMN locked_until TIMESTAMPTZ;
