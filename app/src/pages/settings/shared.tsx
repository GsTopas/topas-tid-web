import { useEffect, useRef, useState, type ReactNode } from "react";

/** Afdelinger (minified `Hd`). */
export const DEPARTMENTS = ["Marketing", "Økonomi", "Digital Transformation", "IT", "Hotel & Administration"];

/** Summen af en ugenorm (array af dagstimer); ikke-array tæller som 0 (`Lb`). */
export const sumNorm = (norm: unknown): number =>
  (Array.isArray(norm) ? norm : []).reduce((sum: number, h: unknown) => sum + Number(h || 0), 0);

/**
 * Fordeler en ugenorm man–fre i kvarterer (`Ny`): man–tors rundes op til nærmeste kvarter,
 * fredag får resten; lør/søn = 0. Fx 37 → 7,5/7,5/7,5/7,5/7.
 */
export const splitWeeklyNorm = (weekHours: unknown): number[] => {
  const total = Math.max(0, Number(weekHours) || 0);
  const perDay = Math.ceil(total / 5 * 4 - 1e-9) / 4;
  const friday = Math.max(0, Math.round((total - perDay * 4) * 4) / 4);
  return [perDay, perDay, perDay, perDay, friday, 0, 0];
};

/**
 * Tilfældigt midlertidigt password: "Topas-" + 10 tegn uden forvekslelige tegn (`qj`).
 * Supabase Auth kræver mindst ét bogstav og ét tal, så der trækkes igen, indtil der er et tal
 * (originalen gjorde ikke det, og ca. hvert 5. forsøg blev afvist).
 */
export const randomTempPassword = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(10);
  for (;;) {
    crypto.getRandomValues(buf);
    const pw = "Topas-" + [...buf].map(r => alphabet[r % alphabet.length]).join("");
    if (meetsPasswordRules(pw)) return pw;
  }
};

/** Supabase Auth's passwordregel: mindst 8 tegn, mindst ét bogstav (a–z/A–Z) og ét tal. */
export const meetsPasswordRules = (pw: string): boolean =>
  pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);

/** Underfane-knap i Settings (`Jo`). */
export function SubTab<T extends string>({
  id,
  sel,
  onSel,
  children
}: {
  id: T;
  sel: T;
  onSel: (id: T) => void;
  children: ReactNode;
}) {
  return <button className={"tab sub" + (sel === id ? " sel" : "")} onClick={() => confirmDiscard() && onSel(id)}>{children}</button>;
}

/* ── Ikke-gemte ændringer + "Gem alle" (erstatter 💾 pr. række) ── */

/** Antal ikke-gemte rækker pr. tabel, så faneskift kan advare. */
const unsaved = new Map<symbol, number>();

/** Spørger før ikke-gemte ændringer smides væk; true = fortsæt. */
export const confirmDiscard = (): boolean =>
  ![...unsaved.values()].some(n => n > 0) ||
  window.confirm("Du har ikke-gemte ændringer. Vil du forlade siden uden at gemme?");

/** Holder styr på hvilke rækker der er ændret og ikke gemt endnu. */
export function useDirtyRows<Id>() {
  const [dirty, setDirty] = useState<Set<Id>>(() => new Set());
  const ref = useRef(dirty);
  ref.current = dirty;
  const key = useRef(Symbol()).current;
  useEffect(() => {
    unsaved.set(key, dirty.size);
    if (!dirty.size) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, key]);
  useEffect(() => () => {
    unsaved.delete(key);
  }, [key]);
  return {
    dirty,
    /** Aktuelle ændrede rækker (også i async-kode efter en await). */
    current: () => ref.current,
    mark: (id: Id) => setDirty(s => s.has(id) ? s : new Set(s).add(id)),
    reset: (ids: Iterable<Id> = []) => setDirty(new Set(ids))
  };
}

/** Beholder brugerens ikke-gemte rækker, når listen hentes igen. */
export const keepDirty = <R extends { id: unknown }>(
  fresh: R[],
  local: R[] | null,
  dirty: Set<R["id"]>,
  merge: (fresh: R, local: R) => R = (_f, l) => l
): R[] =>
  fresh.map(f => {
    const l = dirty.has(f.id) ? local?.find(r => r.id === f.id) : undefined;
    return l ? merge(f, l) : f;
  });

/**
 * Gemmer alle ændrede rækker én ad gangen og melder samlet tilbage.
 * Rækker der fejler, forbliver markeret som ikke-gemte.
 */
export async function saveDirtyRows<R extends { id: unknown; name: string }>(
  rows: R[],
  dirty: Set<R["id"]>,
  saveOne: (row: R) => Promise<void>,
  flash: (msg: string) => void
): Promise<Set<R["id"]>> {
  const failed = new Set<R["id"]>();
  const errors: string[] = [];
  let saved = 0;
  for (const r of rows.filter(r => dirty.has(r.id))) {
    try {
      await saveOne(r);
      saved++;
    } catch (e) {
      failed.add(r.id);
      errors.push(`${r.name || "(uden navn)"}: ${(e as Error).message}`);
    }
  }
  if (!errors.length) {
    flash(`✓ ${saved === 1 ? "1 række" : `${saved} rækker`} gemt`);
  } else {
    flash(`❌ ${saved ? `${saved} gemt, ` : ""}${errors.length} fejlede — ${errors.join(" · ")}`);
  }
  return failed;
}

/** Fast bund-bjælke med "Gem alle", vises kun når der er ikke-gemte ændringer. */
export function SaveAllBar({ count, saving, onSave, onUndo }: {
  count: number;
  saving: boolean;
  onSave: () => void;
  onUndo: () => void;
}) {
  if (!count) return null;
  return <><div className="savebar-spacer" /><div className="savebar"><span className="muted">{count === 1 ? "1 ændret række" : `${count} ændrede rækker`} er ikke gemt</span><div className="savebar-actions"><button className="ghost" disabled={saving} onClick={onUndo}>Fortryd</button><button className="primary" disabled={saving} onClick={onSave}>{saving ? "Gemmer…" : "💾 Gem alle"}</button></div></div></>;
}
