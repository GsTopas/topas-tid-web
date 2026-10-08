import { useState } from "react";
import type { SessionEmployee } from "../../lib/api";
import { Fordelingsregler } from "./Fordelingsregler";
import { Medarbejdere } from "./Medarbejdere";
import { Opgavetyper } from "./Opgavetyper";
import { ProjektAdgang } from "./ProjektAdgang";
import { Projekter } from "./Projekter";
import { Selskaber } from "./Selskaber";
import { SubTab } from "./shared";
import { Timepuljer } from "./Timepuljer";

type SettingsTab = "med" | "sel" | "prj" | "reg" | "opg" | "adg" | "pul";

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
  return <div><div className="pagehead"><h2>⚙️ Settings</h2></div><nav className="tabs subtabs">{isAdmin && <SubTab id="med" sel={tab} onSel={setTab}>👤 Medarbejdere</SubTab>}<SubTab id="sel" sel={tab} onSel={setTab}>🏢 Selskaber</SubTab><SubTab id="prj" sel={tab} onSel={setTab}>📁 Projekter</SubTab>{isAdmin && <SubTab id="reg" sel={tab} onSel={setTab}>🔀 Fordelingsregler</SubTab>}<SubTab id="opg" sel={tab} onSel={setTab}>🏷️ Opgavetyper</SubTab>{isAdmin && <SubTab id="adg" sel={tab} onSel={setTab}>🔐 Projekt-adgang</SubTab>}<SubTab id="pul" sel={tab} onSel={setTab}>📊 Timepuljer</SubTab></nav>{isAdmin && tab === "med" && <Medarbejdere flash={flash} />}{tab === "sel" && <Selskaber flash={flash} onChanged={onChanged} />}{tab === "prj" && <Projekter flash={flash} onChanged={onChanged} isAdmin={isAdmin} />}{isAdmin && tab === "reg" && <Fordelingsregler flash={flash} />}{tab === "opg" && <Opgavetyper flash={flash} onChanged={onChanged} emp={emp} />}{isAdmin && tab === "adg" && <ProjektAdgang flash={flash} onChanged={onChanged} />}{tab === "pul" && <Timepuljer flash={flash} emp={emp} />}</div>;
}
