import { useEffect, useState } from "react";
import { api, signOutNow, type Boot, type Period, type SessionEmployee } from "./lib/api";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { Fakturering } from "./pages/Fakturering";
import { FravaerLoen } from "./pages/FravaerLoen";
import { AfdelingsIndsigt } from "./pages/AfdelingsIndsigt";
import { MinPeriode } from "./pages/MinPeriode";
import { AfdelingsOverblik } from "./pages/AfdelingsOverblik";
import { Settings } from "./pages/settings/Settings";
import { MinTid } from "./pages/mintid/MinTid";
import { useMinTid } from "./pages/mintid/useMinTid";

/** Initialer til avataren (op til to ord). */
const initials = (name: string | null | undefined): string => (name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;

/** Tjekker (ved fokus og hvert 10. minut) om index.html peger på et nyere bundle end det kørende. */
function useNewVersionAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const current = [...document.scripts].map(s => s.src).find(src => BUNDLE_RE.test(src));
    if (!current) {
      return;
    }
    const check = async () => {
      try {
        const m = (await (await fetch(`./?v=${Date.now()}`, {
          cache: "no-store"
        })).text()).match(BUNDLE_RE);
        if (m && !current.endsWith(m[0])) {
          setAvailable(true);
        }
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 600000);
    check();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, []);
  return available;
}

type Tab = "tid" | "periode" | "afdeling" | "okonomi" | "fakturering" | "fravaer" | "admin";

export function App() {
  const [emp, setEmp] = useState<SessionEmployee | null>(null);
  const [boot, setBoot] = useState<Boot | null>(null);
  const newVersion = useNewVersionAvailable();
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<Tab>("tid");
  const [changingPassword, setChangingPassword] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };
  useEffect(() => {
    api.session().then(s => {
      if (s) {
        return start(s);
      }
    }).catch(() => {});
  }, []);
  const start = async (s: SessionEmployee) => {
    setEmp(s);
    if (!s.must_change) {
      setBoot(await api.bootstrap());
    }
  };
  useEffect(() => {
    if (boot) {
      api.periods().then(setPeriods).catch(() => {});
    }
  }, [boot]);
  const mt = useMinTid(boot);
  const period = mt.period;

  if (emp != null && emp.must_change) {
    return <ChangePassword onDone={async () => {
      setEmp({
        ...emp,
        must_change: false
      });
      setBoot(await api.bootstrap());
    }} />;
  }
  if (!emp || !boot) {
    return <Login onLogin={start} />;
  }
  if (changingPassword) {
    return <ChangePassword onDone={() => setChangingPassword(false)} onCancel={() => setChangingPassword(false)} />;
  }
  if (!period) {
    return <div className="page"><p>Ingen aktiv lønperiode.</p></div>;
  }
  const isLeader = emp.is_admin || emp.is_manager;
  const tabs: [Tab, string][] = [["tid", "⏱️ Min tid"], ["periode", isLeader ? "📅 Medarbejder pr. periode" : "📅 Min periode"], ["afdeling", "👥 Afdelings indsigt"], ...(emp.can_economy || emp.is_manager ? [["okonomi", "📋 Afdelings overblik"]] as [Tab, string][] : []), ...(emp.can_economy ? [["fakturering", "💰 Fakturering"], ["fravaer", "🏖️ Fravær & løn"]] as [Tab, string][] : []), ...(isLeader ? [["admin", "⚙️ Settings"]] as [Tab, string][] : [])];
  return <div className="page">{newVersion && <div className="nyversion" role="status"><span>🔄 Der er en ny version af Topas Tid klar.</span><button className="primary" onClick={() => location.reload()}>Opdatér nu</button></div>}<header><div className="brand"><div className="logo">⏱️</div><h1>Topas Tid <span className="badge">Beta</span></h1></div><div className="user"><span>{emp.name}</span><div className="avatar">{initials(emp.name)}</div><button className="linkbtn" onClick={() => setChangingPassword(true)}>Skift password</button><button className="linkbtn" onClick={() => {
          signOutNow();
          location.reload();
        }}>Log ud</button></div></header><nav className="tabs">{tabs.map(([key, label]) => <button className={"tab" + (tab === key ? " sel" : "")} onClick={() => setTab(key)} key={key}>{label}</button>)}</nav>{tab === "periode" && <MinPeriode boot={boot} />}{tab === "afdeling" && <AfdelingsIndsigt emp={emp} />}{tab === "okonomi" && <AfdelingsOverblik emp={emp} flash={flash} />}{tab === "fakturering" && <Fakturering flash={flash} />}{tab === "fravaer" && <FravaerLoen />}{tab === "admin" && <Settings flash={flash} emp={emp} onChanged={async () => setBoot(await api.bootstrap())} />}{tab === "tid" && <MinTid mt={mt} period={period} boot={boot} setBoot={setBoot} emp={emp} periods={periods} flash={flash} />}{toast && <div className="toast">{toast}</div>}</div>;
}
