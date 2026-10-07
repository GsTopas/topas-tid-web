import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bymurhqfcyxdhrayddoz.supabase.co";
// Anon key: public by design (RLS guards the data).
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bXVyaHFmY3l4ZGhyYXlkZG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjcyOTcsImV4cCI6MjA5MzgwMzI5N30.hZ8hvmdK5xpRaZcPR3EWNe2KJS_1QMdgmQJnRnmVZ78";

// Read before createClient: the client consumes and clears the URL hash on startup.
const startHash = new URLSearchParams(window.location.hash.slice(1));
/** True when the page was opened from a "Glemt password" mail link. */
export const openedFromRecoveryLink = startHash.get("type") === "recovery";
/** Set when a mail link was expired or already used (Supabase puts the error in the hash). */
export const recoveryLinkError = startHash.get("error_code") || startHash.get("error") || null;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: "timereg",
  },
});
