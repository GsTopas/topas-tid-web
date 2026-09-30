import { useState, type FormEvent } from "react";
import { api, type SessionEmployee } from "../lib/api";

export function Login({ onLogin }: { onLogin: (emp: SessionEmployee) => unknown }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  return <div className="login"><div className="card"><div className="brand"><div className="logo">⏱️</div><h1>Topas Tid <span className="badge">Beta</span></h1></div><form onSubmit={submit}><label>Mail</label><input type="email" placeholder="dig@topas.dk" value={email} onChange={e => setEmail(e.target.value)} autoFocus={true} /><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} />{error && <div className="error">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy ? "Logger ind…" : "Log ind"}</button></form></div></div>;
}
