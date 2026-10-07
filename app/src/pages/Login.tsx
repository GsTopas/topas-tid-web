import { useState, type FormEvent } from "react";
import { api, type SessionEmployee } from "../lib/api";
import { recoveryLinkError } from "../lib/supabase";

/** "Glemt password?": always confirms, whether or not the mail belongs to a user. */
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
    return <div className="login"><div className="card"><div className="brand"><div className="logo">✉️</div><h1>Tjek din mail</h1></div><p>✓ Password-mail sendt til <b>{sentTo}</b>.</p><p className="muted small">Klik på linket i mailen for at vælge et nyt password. Kan du ikke finde den, så kig i spam.</p><form onSubmit={ev => {
            ev.preventDefault();
            onBack(sentTo);
          }}><button type="submit" className="primary">Tilbage til login</button></form></div></div>;
  }
  return <div className="login"><div className="card"><div className="brand"><div className="logo">🔑</div><h1>Glemt password</h1></div><p className="muted">Skriv din mail, så sender vi et link, hvor du kan vælge et nyt password.</p><form onSubmit={submit}><label>Mail</label><input type="email" required={true} placeholder="dig@topas.dk" value={email} onChange={e => setEmail(e.target.value)} autoFocus={true} /><button type="submit" className="primary" disabled={busy}>{busy ? "Sender…" : "Send link"}</button><button type="button" className="ghost" onClick={() => onBack(email)}>Tilbage til login</button></form></div></div>;
}

export function Login({ onLogin }: { onLogin: (emp: SessionEmployee) => unknown }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(recoveryLinkError ? "Linket er udløbet eller allerede brugt. Bed om et nyt via “Glemt password?”." : "");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    try {
      const res = await api.login(email, password);
      onLogin(res.employee);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (forgot) {
    return <ForgotPassword initialEmail={email} onBack={m => {
      setEmail(m);
      setError("");
      setForgot(false);
    }} />;
  }
  return <div className="login"><div className="card"><div className="brand"><div className="logo">⏱️</div><h1>Topas Tid <span className="badge">Beta</span></h1></div><form onSubmit={submit}><label>Mail</label><input type="email" placeholder="dig@topas.dk" value={email} onChange={e => setEmail(e.target.value)} autoFocus={true} /><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} />{error && <div className="error">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy ? "Logger ind…" : "Log ind"}</button><button type="button" className="linkbtn forgot" onClick={() => setForgot(true)}>Glemt password?</button></form></div></div>;
}
