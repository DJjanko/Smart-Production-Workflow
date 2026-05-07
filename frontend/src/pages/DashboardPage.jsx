import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Hammer, PackageCheck, RefreshCw, UsersRound } from "lucide-react";
import { api } from "../api.js";
import { CopilotPanel } from "../components/CopilotPanel.jsx";
import { InventoryPanel } from "../components/InventoryPanel.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { SafeSilk } from "../components/SafeSilk.jsx";
import { TimelinePanel } from "../components/TimelinePanel.jsx";
import { WorkloadPanel } from "../components/WorkloadPanel.jsx";
import { WorkOrdersTable } from "../components/WorkOrdersTable.jsx";
import { LandingPage } from "./LandingPage.jsx";

const demoCommand = "Ustvari delovni nalog za 5 kosov izdelka Kovinsko ohisje A za podjetje AluTech do petka.";

export function DashboardPage() {
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("spw-session");
    return raw ? JSON.parse(raw) : null;
  });
  const [login, setLogin] = useState({ email: "admin", password: "admin" });
  const [dashboard, setDashboard] = useState(null);
  const [command, setCommand] = useState(demoCommand);
  const [provider, setProvider] = useState("openai");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    const data = await api.dashboard();
    setDashboard(data);
  }

  useEffect(() => {
    if (session) {
      loadDashboard().catch((err) => setError(err.message));
    }
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.login(login);
      localStorage.setItem("spw-session", JSON.stringify(data));
      setSession(data);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runCommand(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.runCommand({ command, provider }, session?.token);
      setResult(data);
      await loadDashboard();
    } catch (err) {
      setResult(null);
      setError(err.message);
      await loadDashboard().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("spw-session");
    setSession(null);
    setDashboard(null);
    setResult(null);
    setError("");
  }

  const timeline = useMemo(() => dashboard?.phases?.slice(0, 12) || [], [dashboard]);
  const inventory = dashboard?.inventory || [];
  const employees = dashboard?.employees || [];
  const workOrders = dashboard?.workOrders || [];
  const activities = dashboard?.activities || [];

  if (!session) {
    return (
      <LandingPage
        error={error}
        loading={loading}
        login={login}
        setLogin={setLogin}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="appShell">
      <div className="dashboardSilk" aria-hidden="true">
        <SafeSilk
          speed={5}
          scale={1.2}
          color="#5227ff"
          noiseIntensity={0.9}
          rotation={0.36}
        />
      </div>

      <Sidebar onLogout={handleLogout} />

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Smart Production Workflow</h1>
          </div>
          <button className="iconText" onClick={() => loadDashboard()} disabled={loading}>
            <RefreshCw size={17} />
            Osvezi
          </button>
        </header>

        {error && (
          <div className="alert">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <section className="metrics">
          <MetricCard icon={<Hammer />} label="Aktivni nalogi" value={dashboard?.activeWorkOrders ?? "-"} tone="blue" />
          <MetricCard icon={<PackageCheck />} label="Nizka zaloga" value={dashboard?.lowStock?.length ?? "-"} tone="amber" />
          <MetricCard icon={<UsersRound />} label="Zaposleni" value={employees.length || "-"} tone="green" />
          <MetricCard icon={<Bot />} label="LLM/MCP akcije" value={activities.length || "-"} tone="red" />
        </section>

        <section className="workspaceGrid">
          <WorkOrdersTable workOrders={workOrders} />
          <InventoryPanel inventory={inventory} />
          <TimelinePanel timeline={timeline} />
          <WorkloadPanel employees={employees} />
        </section>
      </main>

      <CopilotPanel
        activities={activities}
        command={command}
        provider={provider}
        result={result}
        loading={loading}
        setCommand={setCommand}
        setProvider={setProvider}
        onRunCommand={runCommand}
      />
    </div>
  );
}
