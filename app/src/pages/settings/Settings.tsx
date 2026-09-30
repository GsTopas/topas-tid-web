import { useState } from "react";
import type { SessionEmployee } from "../../lib/api";
import { Fordelingsregler } from "./Fordelingsregler";
import { Medarbejdere } from "./Medarbejdere";
import { Opgavetyper } from "./Opgavetyper";
import { ProjektAdgang } from "./ProjektAdgang";
import { SelskaberProjekter } from "./SelskaberProjekter";
import { SubTab } from "./shared";
import { Timepuljer } from "./Timepuljer";

type SettingsTab = "med" | "sel" | "reg" | "opg" | "adg" | "pul";

export function Settings({
  flash,
  onChanged,
  emp
}: {
  flash: (msg: string) => void;
  onChanged: () => void;
  emp: SessionEmployee | null;
}) {
  const isAdmin = emp != null && !!emp.is_admin;
  const [tab, setTab] = useState<SettingsTab>(isAdmin ? "med" : "sel");
  return <div><div className="pagehead"><h2>⚙️ Settings</h2></div><nav className="tabs subtabs">{isAdmin && <SubTab id="med" sel={tab} onSel={setTab}>👤 Medarbejdere</SubTab>}<SubTab id="sel" sel={tab} onSel={setTab}>🏢 Selskaber & projekter</SubTab>{isAdmin && <SubTab id="reg" sel={tab} onSel={setTab}>🔀 Fordelingsregler</SubTab>}<SubTab id="opg" sel={tab} onSel={setTab}>🏷️ Opgavetyper</SubTab>{isAdmin && <SubTab id="adg" sel={tab} onSel={setTab}>🔐 Projekt-adgang</SubTab>}<SubTab id="pul" sel={tab} onSel={setTab}>📊 Timepuljer</SubTab></nav>{isAdmin && tab === "med" && <Medarbejdere flash={flash} />}{tab === "sel" && <SelskaberProjekter flash={flash} onChanged={onChanged} />}{isAdmin && tab === "reg" && <Fordelingsregler flash={flash} />}{tab === "opg" && <Opgavetyper flash={flash} onChanged={onChanged} emp={emp} />}{isAdmin && tab === "adg" && <ProjektAdgang flash={flash} onChanged={onChanged} />}{tab === "pul" && <Timepuljer flash={flash} emp={emp} />}</div>;
}
