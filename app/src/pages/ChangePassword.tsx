import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

/** Skift password. Uden onCancel er det det tvungne skift efter et midlertidigt password. */
export function ChangePassword({ onDone, onCancel }: { onDone: () => unknown; onCancel?: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (pw.length < 8) {
      return setError("Mindst 8 tegn");
    }
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
      return setError("Brug både bogstaver og mindst ét tal");
    }
    if (pw !== pw2) {
      return setError("De to passwords er ikke ens");
    }
    setBusy(true);
    try {
      await api.changePassword(pw);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return <div className="login"><div className="card"><div className="brand"><div className="logo">🔑</div><h1>{onCancel ? "Skift password" : "Vælg dit eget password"}</h1></div>{!onCancel && <p className="muted">Du er logget ind med et midlertidigt password — vælg dit eget for at fortsætte.</p>}<form onSubmit={submit}><label>Nyt password (mindst 8 tegn, bogstaver og tal)</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus={true} /><label>Gentag password</label><input type="password" value={pw2} onChange={e => setPw2(e.target.value)} />{error && <div className="error">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy ? "Gemmer…" : "Gem og fortsæt"}</button>{onCancel && <button type="button" className="ghost" onClick={onCancel}>Fortryd</button>}</form></div></div>;
}
