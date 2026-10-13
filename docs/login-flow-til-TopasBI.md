# Login-flow fra Topas Tid, til genbrug i TopasBI

> **Til Claude i TopasBI-projektet:** Denne guide beskriver præcis, hvordan login er bygget i Topas Tid (repo `GsTopas/topas-tid-web`, mappe `app/`). Byg det samme flow i TopasBI. Koden nedenfor er taget fra Topas Tid og tilpasset med pladsholdere: `<SCHEMA>` (TopasBI's databaseskema), `<APP_URL>` (TopasBI's offentlige URL) og `users` som navnet på TopasBI's brugertabel. Al UI-tekst er dansk. Spørg Gorm (gs@topas.dk, admin) om de beslutninger, der står under "Før du bygger".

## 1. Hvad flowet kan

| Funktion | Hvordan |
|---|---|
| Log ind med mail + password | Supabase Auth `signInWithPassword` direkte fra browseren |
| Brugeren skal være "kendt" i appen | Efter login slås brugeren op i appens egen tabel via `auth_user_id`. Findes de ikke (eller er inaktive), logges de ud igen med en dansk fejl |
| Admin opretter login | Edge Function `onboard` (service role) opretter Auth-brugeren med et **midlertidigt password**, som admin får vist én gang og giver videre |
| Tvunget skift af password | Ny bruger (og efter "Nulstil pw") har `must_change = true` i `user_metadata`; appen viser "Vælg dit eget password", før noget andet |
| Glemt password | `resetPasswordForEmail` med `redirectTo` = appens egen URL. Svaret er **altid** "Password-mail sendt til xx", også for ukendte mails (Gorms regel: afslør ikke hvilke mails der findes) |
| Link fra mailen | Logger brugeren ind og tvinger skærmen "Vælg nyt password". Udløbet/brugt link giver en dansk besked på login-skærmen |
| Skift password selv | Knap i headeren |
| Log ud | `signOut()` + reload |
| Sikkerhed | **Row Level Security er sikkerhedsgrænsen.** Frontend skjuler faner efter rolle, men databasen håndhæver adgangen via SQL-hjælpefunktioner |

Passwordregel (Supabase Auth i projektet afviser alt andet): **mindst 8 tegn, mindst ét bogstav og ét tal.**

## 2. Før du bygger: afklar med Gorm

1. **Samme Supabase-projekt som Topas Tid (`bymurhqfcyxdhrayddoz`) eller et eget?**
   - *Samme projekt:* `auth.users` er fælles. En medarbejder, der allerede har Topas Tid-login, har så **samme mail og password** i TopasBI, og "Glemt password" i den ene app ændrer det i den anden. Det er normalt en fordel (ét login), men så:
     - må `onboard` i TopasBI **ikke** oprette en ny Auth-bruger, hvis mailen allerede findes; den skal blot koble den eksisterende (se `link`-handlingen i afsnit 5),
     - må TopasBI **ikke** sætte `must_change` på en bruger, der allerede bruger Topas Tid (flaget ligger i den fælles `user_metadata` og ville tvinge skift i begge apps). Brug kun `must_change` for helt nye logins,
     - skal TopasBI-schemaet **tilføjes** til `pgrst.db_schemas`, ikke erstatte listen (se afsnit 4),
     - Edge Function skal have et andet navn end `onboard`, fx `onboard_bi`, så Topas Tids funktion ikke overskrives,
     - password-mailen er Supabase's standardskabelon og er fælles for alle apps i projektet (den er på engelsk).
   - *Eget projekt:* alt er uafhængigt; brug navnene som de står.
2. TopasBI's URL (`<APP_URL>`), som skal stå under **Authentication → URL Configuration → Redirect URLs**. Mangler den, sender reset-linket brugeren til projektets Site URL (i Topas Tids projekt er det teg-plan).
3. Hvilke roller TopasBI har brug for (Topas Tid har `is_admin`, `is_manager`, afdeling). Behold mindst `is_admin`, da login-administration kræver det.

## 3. Arkitektur

```
Browser (React + supabase-js, anon key)
  ├─ supabase.auth.*            → login, logout, reset, skift password
  ├─ supabase.from(<SCHEMA>.*)  → data; brugerens JWT, RLS afgør hvad der ses
  └─ supabase.functions.invoke("onboard") → kun admin; opret/nulstil/slet login
Edge Function onboard (service role key, verify_jwt = true)
  └─ tjekker at kalderen er aktiv admin i <SCHEMA>.users, kalder auth.admin.*
Postgres
  ├─ <SCHEMA>.users.auth_user_id  → kobling til auth.users
  └─ RLS + SECURITY DEFINER-hjælpere (current_user_id(), me_is_admin(), …)
```

Anon key ligger åbent i frontend-koden. Det er meningen: den giver ingen adgang uden for RLS.

## 4. Database (migration)

Læg som migration, fx `supabase/migrations/<timestamp>_auth_foundation.sql`, og kør den med Supabase MCP `apply_migration` med samme navn.

```sql
-- Skema og brugertabel
CREATE SCHEMA IF NOT EXISTS <SCHEMA>;

CREATE TABLE <SCHEMA>.users (
  id           serial PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  email        text UNIQUE,              -- gemmes lowercase
  is_admin     boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  auth_user_id uuid UNIQUE               -- kobling til auth.users
);

-- Hjælpefunktioner: SECURITY DEFINER så de kan læse users uden at ramme RLS.
-- search_path låses af sikkerhedshensyn.
CREATE OR REPLACE FUNCTION <SCHEMA>.current_user_id() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = <SCHEMA> AS
$$ SELECT id FROM users WHERE auth_user_id = auth.uid() AND active $$;

CREATE OR REPLACE FUNCTION <SCHEMA>.me_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = <SCHEMA> AS
$$ SELECT COALESCE((SELECT is_admin FROM users
   WHERE auth_user_id = auth.uid() AND active), false) $$;

-- RLS
ALTER TABLE <SCHEMA>.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON <SCHEMA>.users FOR SELECT TO authenticated
  USING (id = <SCHEMA>.current_user_id() OR <SCHEMA>.me_is_admin());
CREATE POLICY users_admin_insert ON <SCHEMA>.users FOR INSERT TO authenticated
  WITH CHECK (<SCHEMA>.me_is_admin());
CREATE POLICY users_admin_update ON <SCHEMA>.users FOR UPDATE TO authenticated
  USING (<SCHEMA>.me_is_admin()) WITH CHECK (<SCHEMA>.me_is_admin());

-- Grants: anon får INTET. authenticated får tabellerne; RLS begrænser rækkerne.
GRANT USAGE ON SCHEMA <SCHEMA> TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA <SCHEMA> TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA <SCHEMA> TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA <SCHEMA> TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA <SCHEMA> TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA <SCHEMA> TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <SCHEMA> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA <SCHEMA> GRANT ALL ON TABLES TO service_role;

-- auth_user_id må kun sættes af Edge Function (service role), aldrig fra browseren.
REVOKE INSERT, UPDATE ON <SCHEMA>.users FROM authenticated;
GRANT INSERT (name, email, is_admin, active) ON <SCHEMA>.users TO authenticated;
GRANT UPDATE (name, email, is_admin, active) ON <SCHEMA>.users TO authenticated;

-- Eksponér skemaet for supabase-js. VIGTIGT: tilføj til den eksisterende liste.
-- Tjek først: SELECT setconfig FROM pg_db_role_setting WHERE setrole = 'authenticator'::regrole;
-- I Topas Tids projekt er listen i dag 'public, graphql_public, timereg'.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, timereg, <SCHEMA>';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
```

Mønster for alle øvrige tabeller: `ENABLE ROW LEVEL SECURITY` + policies, der bruger hjælpefunktionerne, fx `USING (owner_id = <SCHEMA>.current_user_id() OR <SCHEMA>.me_is_admin())`. Skrivninger, der skal være atomare eller krydstjekkes, laves som `SECURITY DEFINER`-RPC'er med eget rettighedstjek (Topas Tid mistede data på en delete-then-insert fra browseren).

**Første admin (bootstrap):** Edge Function kræver en admin. Opret derfor den første admin manuelt: lav brugeren i Supabase Dashboard → Authentication → Add user (mail + password, "Auto confirm"), og kør så
```sql
INSERT INTO <SCHEMA>.users (name, email, is_admin, auth_user_id)
SELECT 'Gorm', 'gs@topas.dk', true, id FROM auth.users WHERE email = 'gs@topas.dk';
```
(Findes Gorm allerede i `auth.users` fordi projektet er fælles, så spring første trin over.)

## 5. Edge Function `onboard`

Deploy med `verify_jwt = true`. `SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` findes automatisk i Edge Functions. Handlinger: `create`, `reset`, `delete`, plus `link` (kun relevant ved fælles Supabase-projekt).

```ts
// <SCHEMA> login-administration. Kræver ALTID admin-JWT (fejler lukket).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: "<SCHEMA>" },
  });

  // Kalderen SKAL være en aktiv admin
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: callerData } = await admin.auth.getUser(jwt);
  const caller = callerData?.user ?? null;
  let isAdmin = false;
  if (caller) {
    const { data: me } = await admin.from("users").select("is_admin")
      .eq("auth_user_id", caller.id).eq("active", true).maybeSingle();
    isAdmin = !!me?.is_admin;
  }
  if (!isAdmin) return json({ error: "Kun admin kan administrere logins" }, 403);

  let body: { action?: string; email?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: "Ugyldig JSON" }, 400); }
  const action = body.action ?? "create";
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email) return json({ error: "email kræves" }, 400);
  if ((action === "create" || action === "reset") && password.length < 8) {
    return json({ error: "password skal være mindst 8 tegn" }, 400);
  }

  // Eksakt match (mails gemmes lowercase), ingen ilike-wildcards
  const { data: u } = await admin.from("users").select("id, name, auth_user_id")
    .eq("email", email).eq("active", true).maybeSingle();
  if (!u) return json({ error: `Ingen aktiv bruger med mailen ${email}` }, 404);

  if (action === "create") {
    if (u.auth_user_id) return json({ error: "Brugeren har allerede et login" }, 409);
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: u.name, must_change: true },
    });
    if (error) return json({ error: error.message }, 400); // fx "already registered" → brug "link"
    const { error: linkErr } = await admin.from("users").update({ auth_user_id: created.user.id }).eq("id", u.id);
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id); // ingen forældreløse Auth-brugere
      return json({ error: "Kobling til bruger fejlede, login rullet tilbage" }, 500);
    }
    return json({ ok: true, action, user_id: u.id });
  }

  // Kun ved fælles Supabase-projekt: kobl en Auth-bruger, der allerede findes (fx fra Topas Tid).
  // Rører ikke password eller must_change, så den anden app påvirkes ikke.
  if (action === "link") {
    if (u.auth_user_id) return json({ error: "Brugeren har allerede et login" }, 409);
    const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return json({ error: error.message }, 400);
    const existing = list.users.find((x) => (x.email ?? "").toLowerCase() === email);
    if (!existing) return json({ error: "Der findes intet login med den mail. Brug Opret login" }, 404);
    await admin.from("users").update({ auth_user_id: existing.id }).eq("id", u.id);
    return json({ ok: true, action, user_id: u.id });
  }

  if (action === "reset") {
    if (!u.auth_user_id) return json({ error: "Brugeren har intet login endnu" }, 404);
    const { error } = await admin.auth.admin.updateUserById(u.auth_user_id, {
      password, user_metadata: { name: u.name, must_change: true },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action, user_id: u.id });
  }

  if (action === "delete") {
    if (!u.auth_user_id) return json({ error: "Brugeren har intet login" }, 404);
    // Ved fælles projekt: slet IKKE Auth-brugeren (den bruges også af Topas Tid); fjern kun koblingen.
    const { error } = await admin.auth.admin.deleteUser(u.auth_user_id);
    if (error) return json({ error: error.message }, 400);
    await admin.from("users").update({ auth_user_id: null }).eq("id", u.id);
    return json({ ok: true, action, user_id: u.id });
  }

  return json({ error: `Ukendt action: ${action}` }, 400);
});
```

Ved fælles projekt: lad `delete` kun sætte `auth_user_id = null` (fjern `deleteUser`-kaldet), og vis "Kobl eksisterende login" (`link`) i stedet for "Opret login", når `create` svarer "already registered".

## 6. Frontend (React + TypeScript, `@supabase/supabase-js@2`)

### 6.1 `lib/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://<PROJECT_REF>.supabase.co";
// Anon key: offentlig med vilje (RLS beskytter data).
const SUPABASE_ANON_KEY = "<ANON_KEY>";

// Læses FØR createClient: klienten læser og rydder URL-hashen ved opstart.
const startHash = new URLSearchParams(window.location.hash.slice(1));
/** True når siden er åbnet fra et "Glemt password"-link. */
export const openedFromRecoveryLink = startHash.get("type") === "recovery";
/** Sat når linket var udløbet eller allerede brugt (Supabase lægger fejlen i hashen). */
export const recoveryLinkError = startHash.get("error_code") || startHash.get("error") || null;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: "<SCHEMA>" },
});
```

### 6.2 Auth-delen af `lib/api.ts` (UI kalder aldrig `supabase` direkte)

```ts
import { supabase } from "./supabase";

export interface SessionUser {
  id: number; name: string; is_admin: boolean;
  must_change: boolean; email: string | undefined;
}

export async function currentUser(): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  const { data: rows } = await supabase.from("users")
    .select("id, name, is_admin").eq("auth_user_id", data.user.id).eq("active", true);
  if (!rows?.length) return null;
  const meta = data.user.user_metadata;
  return { ...rows[0], must_change: !!meta?.must_change, email: data.user.email };
}

export const api = {
  async login(email: string, password: string): Promise<SessionUser> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid login credentials/i.test(error.message) ? "Forkert mail eller password" : error.message);
    const user = await currentUser();
    if (!user) {
      await supabase.auth.signOut();
      throw new Error("Dit login er ikke koblet til en aktiv bruger, kontakt admin");
    }
    return user;
  },

  async session(): Promise<SessionUser | null> {
    const { data } = await supabase.auth.getSession();
    return data?.session ? currentUser() : null;
  },

  /** Fejl sluges med vilje: skærmen siger altid, at mailen er sendt. */
  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = window.location.origin + window.location.pathname;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) console.warn("resetPasswordForEmail", error.message);
    } catch (err) {
      console.warn("resetPasswordForEmail", err);
    }
  },

  async changePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password, data: { must_change: false } });
    if (error) throw new Error(error.message);
  },

  async logout(): Promise<void> { await supabase.auth.signOut(); },

  /** Edge Function "onboard": opret/nulstil/slet login (kun admin). */
  async manageLogin(action: "create" | "reset" | "delete" | "link", email: string, password?: string) {
    const { data, error } = await supabase.functions.invoke("onboard", { body: { action, email, password } });
    if (error) {
      let message = error.message;
      try {
        const body = await (error as { context?: { json(): Promise<{ error?: string } | null> } }).context?.json();
        if (body?.error) message = body.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return data;
  },
};
```

### 6.3 Passwordhjælpere (bruges af admin-skærmen)

```ts
/** Supabase Auth's regel: mindst 8 tegn, mindst ét bogstav og ét tal. */
export const meetsPasswordRules = (pw: string): boolean =>
  pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);

/** Midlertidigt password, fx "Topas-k7QmR2xbNw". Uden 0/O/1/l/I for at undgå forvekslinger. */
export const randomTempPassword = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(10);
  for (;;) {
    crypto.getRandomValues(buf);
    const pw = "Topas-" + [...buf].map((r) => alphabet[r % alphabet.length]).join("");
    if (meetsPasswordRules(pw)) return pw;
  }
};
```

Test (vitest), som i Topas Tid: generér 2000 passwords og tjek at alle matcher `/^Topas-[A-Za-z2-9]{10}$/` og `meetsPasswordRules`.

### 6.4 `pages/Login.tsx`

```tsx
import { useState, type FormEvent } from "react";
import { api, type SessionUser } from "../lib/api";
import { recoveryLinkError } from "../lib/supabase";

/** "Glemt password?": bekræfter altid, uanset om mailen findes. */
function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: (email: string) => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    await api.requestPasswordReset(email);
    setBusy(false);
    setSentTo(email.trim());
  };
  if (sentTo) {
    return (
      <div className="login"><div className="card">
        <h1>Tjek din mail</h1>
        <p>✓ Password-mail sendt til <b>{sentTo}</b>.</p>
        <p className="muted small">Klik på linket i mailen for at vælge et nyt password. Kan du ikke finde den, så kig i spam.</p>
        <button className="primary" onClick={() => onBack(sentTo)}>Tilbage til login</button>
      </div></div>
    );
  }
  return (
    <div className="login"><div className="card">
      <h1>Glemt password</h1>
      <p className="muted">Skriv din mail, så sender vi et link, hvor du kan vælge et nyt password.</p>
      <form onSubmit={submit}>
        <label>Mail</label>
        <input type="email" required placeholder="dig@topas.dk" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <button type="submit" className="primary" disabled={busy}>{busy ? "Sender…" : "Send link"}</button>
        <button type="button" className="ghost" onClick={() => onBack(email)}>Tilbage til login</button>
      </form>
    </div></div>
  );
}

export function Login({ onLogin }: { onLogin: (u: SessionUser) => unknown }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(recoveryLinkError ? "Linket er udløbet eller allerede brugt. Bed om et nyt via “Glemt password?”." : "");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    try { onLogin(await api.login(email, password)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  if (forgot) {
    return <ForgotPassword initialEmail={email} onBack={(m) => { setEmail(m); setError(""); setForgot(false); }} />;
  }
  return (
    <div className="login"><div className="card">
      <h1>TopasBI</h1>
      <form onSubmit={submit}>
        <label>Mail</label>
        <input type="email" placeholder="dig@topas.dk" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button type="submit" className="primary" disabled={busy}>{busy ? "Logger ind…" : "Log ind"}</button>
        <button type="button" className="linkbtn forgot" onClick={() => setForgot(true)}>Glemt password?</button>
      </form>
    </div></div>
  );
}
```

### 6.5 `pages/ChangePassword.tsx`

```tsx
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

/** Uden onCancel: tvunget skift (midlertidigt password) eller recovery (link fra "Glemt password"). */
export function ChangePassword({ onDone, onCancel, recovery }: { onDone: () => unknown; onCancel?: () => void; recovery?: boolean }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (pw.length < 8) return setError("Mindst 8 tegn");
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return setError("Brug både bogstaver og mindst ét tal");
    if (pw !== pw2) return setError("De to passwords er ikke ens");
    setBusy(true);
    try { await api.changePassword(pw); onDone(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="login"><div className="card">
      <h1>{onCancel ? "Skift password" : recovery ? "Vælg nyt password" : "Vælg dit eget password"}</h1>
      {!onCancel && !recovery && <p className="muted">Du er logget ind med et midlertidigt password. Vælg dit eget for at fortsætte.</p>}
      <form onSubmit={submit}>
        <label>Nyt password (mindst 8 tegn, bogstaver og tal)</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <label>Gentag password</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button type="submit" className="primary" disabled={busy}>{busy ? "Gemmer…" : "Gem og fortsæt"}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Fortryd</button>}
      </form>
    </div></div>
  );
}
```

### 6.6 `App.tsx`: rækkefølgen af skærme

```tsx
export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  // Åbnet fra "Glemt password"-mail: linket logger ind; der SKAL vælges nyt password først.
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);

  useEffect(() => { api.session().then((u) => u && setUser(u)).catch(() => {}); }, []);

  // 1) Tvunget skift: nyt login / nulstillet / recovery-link
  if (user && (user.must_change || recovering)) {
    return <ChangePassword recovery={recovering} onDone={() => {
      setRecovering(false);
      setUser({ ...user, must_change: false });
    }} />;
  }
  // 2) Ikke logget ind
  if (!user) return <Login onLogin={setUser} />;
  // 3) Frivilligt skift fra headeren
  if (changingPassword) {
    return <ChangePassword onDone={() => setChangingPassword(false)} onCancel={() => setChangingPassword(false)} />;
  }
  // 4) Selve appen. Faner efter rolle (user.is_admin), men RLS er det, der håndhæver.
  return (
    <div className="page">
      <header>
        <span>{user.name}</span>
        <button className="linkbtn" onClick={() => setChangingPassword(true)}>Skift password</button>
        <button className="linkbtn" onClick={async () => { await api.logout(); location.reload(); }}>Log ud</button>
      </header>
      {/* … */}
    </div>
  );
}
```

### 6.7 Admin: "Opret login" / "Nulstil pw"

På bruger-listen (kun admin): har rækken `auth_user_id`, vis "Nulstil pw", ellers "Opret login" (eller "mangler mail" uden mail).

```ts
const manageLogin = async (u: UserRow, action: "create" | "reset") => {
  const password = randomTempPassword();
  try {
    await api.manageLogin(action, u.email!, password);
    setPwInfo(`${u.email} → midlertidigt password: ${password}`); // vises kun her
    reload();
  } catch (e) {
    flash("❌ " + (e as Error).message);
  }
};
// <p className="ok">🔑 {pwInfo}. Skriv det ned, det vises kun her!</p>
```

Admin giver det midlertidige password til personen, som så tvinges til "Vælg dit eget password" ved første login.

## 7. Opsætning i Supabase Dashboard (gøres af Gorm)

1. **Authentication → URL Configuration → Redirect URLs:** tilføj `<APP_URL>` (præcis den URL appen kører på, med afsluttende `/`). Ellers lander reset-linket på Site URL.
2. **Authentication → Providers → Email:** Email aktiveret. Selvregistrering ("Allow new users to sign up") bør være slået fra, så kun admin opretter logins.
3. **Authentication → Policies/Password:** mindstelængde 8, krav om bogstaver og tal (matcher frontend-tjekket).
4. Edge Function deployet med `verify_jwt = true`.
5. Første admin oprettet (afsnit 4).

## 8. Test inden det går live

- Log ind med rigtig mail/password → appen. Forkert password → "Forkert mail eller password".
- Login, der findes i Auth men ikke i `<SCHEMA>.users` (eller er inaktiv) → logges ud med "ikke koblet til en aktiv bruger".
- Admin: "Opret login" → midlertidigt password vises → log ind med det → tvunget "Vælg dit eget password" → appen.
- "Glemt password?" med kendt og ukendt mail → samme bekræftelse begge gange.
- Klik linket i mailen → "Vælg nyt password" → appen. Klik samme link igen → dansk "Linket er udløbet…" på login-skærmen.
- Som almindelig bruger: `supabase.from("users").select("*")` i konsollen giver kun egen række; `functions.invoke("onboard")` giver 403.
- Kør Supabase Security Advisor (`get_advisors`) og ret evt. tabeller uden RLS.
