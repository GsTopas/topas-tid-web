import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bymurhqfcyxdhrayddoz.supabase.co";
// Anon key: public by design (RLS guards the data).
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bXVyaHFmY3l4ZGhyYXlkZG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjcyOTcsImV4cCI6MjA5MzgwMzI5N30.hZ8hvmdK5xpRaZcPR3EWNe2KJS_1QMdgmQJnRnmVZ78";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: "timereg",
  },
});
