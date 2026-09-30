// Recovered 2026-09-30 from Supabase Edge Function "onboard" (version 3, verify_jwt = true),
// project bymurhqfcyxdhrayddoz. Called from the app as Fe.functions.invoke("onboard", {action, email, password}).
// Topas Tid — login-administration (v3, sikkerhedshaerdet)
// Handlinger: create (opret login), reset (nyt midlertidigt password),
// delete (fjern login/offboarding). Kraever ALTID admin-JWT — bootstrap-
// undtagelsen er fjernet efter gennemfoert onboarding (audit-fund 2026-08).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "timereg" } },
  );

  // Kalderen SKAL vaere en aktiv admin — fejler lukket
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: callerData } = await admin.auth.getUser(jwt);
  const caller = callerData?.user ?? null;
  let isAdmin = false;
  if (caller) {
    const { data: me } = await admin
      .from("employees")
      .select("is_admin")
      .eq("auth_user_id", caller.id)
      .eq("active", true)
      .maybeSingle();
    isAdmin = !!me?.is_admin;
  }
  if (!isAdmin) return json({ error: "Kun admin kan administrere logins" }, 403);

  let body: { action?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ugyldig JSON" }, 400);
  }
  const action = body.action ?? "create";
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email) return json({ error: "email kraeves" }, 400);
  if (action !== "delete" && password.length < 8) {
    return json({ error: "password skal vaere mindst 8 tegn" }, 400);
  }

  // Eksakt match (mails gemmes lowercase) — ingen ilike-wildcards
  const { data: emp } = await admin
    .from("employees")
    .select("id, name, auth_user_id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (!emp) return json({ error: `Ingen aktiv medarbejder med mailen ${email}` }, 404);

  if (action === "create") {
    if (emp.auth_user_id) return json({ error: "Medarbejderen har allerede et login" }, 409);
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: emp.name, must_change: true },
    });
    if (error) return json({ error: error.message }, 400);
    const { error: linkErr } = await admin
      .from("employees")
      .update({ auth_user_id: created.user.id })
      .eq("id", emp.id);
    if (linkErr) {
      // Ingen foraeldreloese auth-brugere: ryd op hvis koblingen fejler
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "Kobling til medarbejder fejlede — login rullet tilbage" }, 500);
    }
    return json({ ok: true, action, employee_id: emp.id });
  }

  if (action === "reset") {
    if (!emp.auth_user_id) return json({ error: "Medarbejderen har intet login endnu" }, 404);
    const { error } = await admin.auth.admin.updateUserById(emp.auth_user_id, {
      password,
      user_metadata: { name: emp.name, must_change: true },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action, employee_id: emp.id });
  }

  if (action === "delete") {
    if (!emp.auth_user_id) return json({ error: "Medarbejderen har intet login" }, 404);
    const { error } = await admin.auth.admin.deleteUser(emp.auth_user_id);
    if (error) return json({ error: error.message }, 400);
    await admin.from("employees").update({ auth_user_id: null }).eq("id", emp.id);
    return json({ ok: true, action, employee_id: emp.id });
  }

  return json({ error: `Ukendt action: ${action}` }, 400);
});
