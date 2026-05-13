import { useEffect, useState } from "react";
import { Bell, PackageX, X } from "lucide-react";
import { api } from "./api.js";
import { CopilotPanel } from "./components/CopilotPanel.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { SafeSilk } from "./components/SafeSilk.jsx";
import { AccountPage } from "./pages/AccountPage.jsx";
import { ComparisonPage } from "./pages/ComparisonPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { EmployeesPage } from "./pages/EmployeesPage.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { OrdersPage } from "./pages/OrdersPage.jsx";
import { PartsInventoryPage } from "./pages/PartsInventoryPage.jsx";
import { ProductsPage } from "./pages/ProductsPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { TimelinePage } from "./pages/TimelinePage.jsx";
import { WorkOrdersPage } from "./pages/WorkOrdersPage.jsx";
import { label } from "./utils/i18n.js";

const demoCommand = "Ustvari delovni nalog za 5 kosov izdelka Kovinsko ohisje A za podjetje AluTech do petka.";

function NotificationCenter({ alerts, isAdmin, onOpenAlert, onResolveAlert }) {
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <div className="notificationCenter">
      <button type="button" className="notificationBell" onClick={() => setOpen((current) => !current)} aria-label="Odpri opozorila">
        <Bell size={17} />
        <span>{alerts.length}</span>
      </button>

      {open && (
        <div className="notificationDropdown">
          <div className="notificationHeader">
            <Bell size={17} />
            <strong>{label("alerts")}</strong>
            <span>{alerts.length}</span>
          </div>
          <div className="notificationList">
            {alerts.slice(0, 4).map((alert) => (
              <div
                className="notificationItem"
                key={alert._id}
                role="button"
                tabIndex={0}
                onClick={() => { setOpen(false); onOpenAlert(alert); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpen(false);
                    onOpenAlert(alert);
                  }
                }}
              >
                <PackageX size={17} />
                <div>
                  <strong>{alert.partId?.name || "Material"}</strong>
                  <span>{alert.message}</span>
                  <span>{label("sentBy")}: {alert.createdByName || label("noData")}</span>
                </div>
                <button type="button" className="notificationResolve" onClick={(event) => { event.stopPropagation(); onResolveAlert(alert._id); }} aria-label="Oznaci kot reseno">
                  <X size={14} />
                </button>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="notificationEmpty">
                <PackageX size={17} />
                <span>{label("noAlerts")}</span>
              </div>
            )}
          </div>
          <div className="notificationHint">
            {label("alertHint")}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [, setLanguageVersion] = useState(0);
  const [session, setSession] = useState(() => {
    const raw = localStorage.getItem("spw-session");
    return raw ? JSON.parse(raw) : null;
  });
  const [login, setLogin] = useState({ email: "admin", password: "admin" });
  const [activePage, setActivePage] = useState("dashboard");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [activities, setActivities] = useState([]);
  const [supplyAlerts, setSupplyAlerts] = useState([]);
  const [highlightLowStock, setHighlightLowStock] = useState(false);
  const [command, setCommand] = useState(demoCommand);
  const [provider, setProvider] = useState("ollama");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);

  async function loadActivities() {
    const data = await api.activityLog();
    setActivities(data);
  }

  async function loadSupplyAlerts() {
    if (session?.user?.role !== "admin") return;
    const data = await api.supplyAlerts(session.token);
    setSupplyAlerts(data);
  }

  useEffect(() => {
    if (session) {
      loadActivities().catch(() => {});
      loadSupplyAlerts().catch(() => {});
    }
  }, [session]);

  useEffect(() => {
    function handleLanguageChange() {
      setLanguageVersion((version) => version + 1);
    }

    window.addEventListener("spw-language-changed", handleLanguageChange);
    return () => window.removeEventListener("spw-language-changed", handleLanguageChange);
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.login(login);
      localStorage.setItem("spw-session", JSON.stringify(data));
      localStorage.setItem("spw-language", data.user?.language || "sl");
      setSession(data);
      window.dispatchEvent(new Event("spw-language-changed"));
      setActivePage("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("spw-session");
    setSession(null);
    setActivePage("dashboard");
    setActivities([]);
    setSupplyAlerts([]);
    setResult(null);
    setError("");
  }

  async function runAssistantCommand(event) {
    event.preventDefault();
    setAssistantLoading(true);

    try {
      const data = await api.runCommand({ command, provider }, session?.token);
      setResult(data);
      await loadActivities();
    } catch (err) {
      setResult({ interpreted: { intent: "error", message: err.message } });
      await loadActivities().catch(() => {});
    } finally {
      setAssistantLoading(false);
    }
  }

  async function acceptPendingAction(id) {
    setAssistantLoading(true);

    try {
      const data = await api.acceptPendingAction(id, session?.token);
      setResult(data);
      await loadActivities();
    } catch (err) {
      setResult({ interpreted: { intent: "error", message: err.message } });
      await loadActivities().catch(() => {});
    } finally {
      setAssistantLoading(false);
    }
  }

  async function declinePendingAction(id) {
    setAssistantLoading(true);

    try {
      const data = await api.declinePendingAction(id, session?.token);
      setResult(data);
      await loadActivities();
    } catch (err) {
      setResult({ interpreted: { intent: "error", message: err.message } });
      await loadActivities().catch(() => {});
    } finally {
      setAssistantLoading(false);
    }
  }

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

  const pageProps = { session };
  const isAdmin = session.user?.role === "admin";
  const pages = {
    dashboard: <DashboardPage {...pageProps} />,
    products: <ProductsPage {...pageProps} />,
    inventory: <PartsInventoryPage {...pageProps} highlightLowStock={highlightLowStock} supplyAlerts={supplyAlerts} />,
    employees: <EmployeesPage {...pageProps} />,
    orders: <OrdersPage {...pageProps} />,
    workOrders: <WorkOrdersPage {...pageProps} />,
    timeline: <TimelinePage {...pageProps} />,
    comparison: <ComparisonPage {...pageProps} />,
    settings: isAdmin ? <SettingsPage {...pageProps} /> : <DashboardPage {...pageProps} />,
    account: <AccountPage {...pageProps} onSupplyAlertCreated={loadSupplyAlerts} />
  };

  async function resolveSupplyAlert(id) {
    await api.resolveSupplyAlert(id, session.token);
    await loadSupplyAlerts();
  }

  return (
    <div className={`appShell ${assistantOpen ? "" : "appShellAssistantHidden"}`}>
      <div className="dashboardSilk" aria-hidden="true">
        <SafeSilk
          speed={5}
          scale={1.2}
          color="#5227ff"
          noiseIntensity={0.9}
          rotation={0.36}
        />
      </div>

      <Sidebar activePage={activePage} onNavigate={setActivePage} onLogout={handleLogout} session={session} />
      <NotificationCenter
        alerts={supplyAlerts}
        isAdmin={session.user?.role === "admin"}
        onOpenAlert={() => { setActivePage("inventory"); setHighlightLowStock(Date.now()); }}
        onResolveAlert={resolveSupplyAlert}
      />
      {pages[activePage] || pages.dashboard}
      {assistantOpen ? (
        <CopilotPanel
          activities={activities}
          command={command}
          provider={provider}
          result={result}
          loading={assistantLoading}
          setCommand={setCommand}
          setProvider={setProvider}
          onRunCommand={runAssistantCommand}
          onAcceptPending={acceptPendingAction}
          onDeclinePending={declinePendingAction}
          onHide={() => setAssistantOpen(false)}
        />
      ) : (
        <button type="button" className="copilotReveal" onClick={() => setAssistantOpen(true)}>
          AI assistant
        </button>
      )}
    </div>
  );
}

export default App;
