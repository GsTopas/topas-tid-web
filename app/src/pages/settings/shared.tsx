import type { ReactNode } from "react";

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

/** Tilfældigt midlertidigt password: "Topas-" + 10 tegn uden forvekslelige tegn (`qj`). */
export const randomTempPassword = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return "Topas-" + [...buf].map(r => alphabet[r % alphabet.length]).join("");
};

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
  return <button className={"tab sub" + (sel === id ? " sel" : "")} onClick={() => onSel(id)}>{children}</button>;
}
