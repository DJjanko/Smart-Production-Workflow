import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Hammer, PackageCheck, UsersRound } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { InventoryPanel } from "../components/InventoryPanel.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { TimelinePanel } from "../components/TimelinePanel.jsx";
import { WorkloadPanel } from "../components/WorkloadPanel.jsx";
import { WorkOrdersTable } from "../components/WorkOrdersTable.jsx";
import { formatDate } from "../utils/date.js";

export function DashboardPage({ session }) {
  const [dashboard, setDashboard] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [phases, setPhases] = useState([]);
  const [error, setError] = useState("");
  const [loadingPhase, setLoadingPhase] = useState(null);
  const isAdmin = session?.user?.role === "admin";

  async function loadDashboard() {
    if (isAdmin) {
      const data = await api.dashboard();
      setDashboard(data);
      return;
    }

    const [workOrderData, phaseData] = await Promise.all([api.workOrders(), api.workOrderPhases()]);
    setWorkOrders(workOrderData);
    setPhases(phaseData);
  }

  useEffect(() => {
    if (session) {
      loadDashboard().catch((err) => setError(err.message));
    }
  }, [session]);

  const timeline = useMemo(() => dashboard?.phases?.slice(0, 12) || [], [dashboard]);
  const inventory = dashboard?.inventory || [];
  const employees = dashboard?.employees || [];
  const dashboardWorkOrders = dashboard?.workOrders || [];
  const activities = dashboard?.activities || [];
  const myPhases = useMemo(() => phases.filter((phase) => phase.assignedToName === session?.user?.name), [phases, session?.user?.name]);
  const myWorkOrderIds = useMemo(() => new Set(myPhases.map((phase) => String(phase.workOrderId?._id || phase.workOrderId))), [myPhases]);
  const myWorkOrders = useMemo(() => workOrders.filter((order) => myWorkOrderIds.has(String(order._id))), [workOrders, myWorkOrderIds]);

  async function updateMyPhaseStatus(phase, status) {
    setError("");
    setLoadingPhase(phase._id);
    try {
      await api.updateWorkOrderPhase(phase._id, { status }, session.token);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPhase(null);
    }
  }

  if (!isAdmin) {
    return (
      <main className="main">
        <header className="topbar">
          <div>
            <h1>Moj pregled</h1>
            <p>Dodeljene faze in delovni nalogi.</p>
          </div>
        </header>

        {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

        <section className="metrics">
          <MetricCard icon={<Hammer />} label="Moji nalogi" value={myWorkOrders.length} tone="blue" />
          <MetricCard icon={<PackageCheck />} label="Moje faze" value={myPhases.length} tone="amber" />
          <MetricCard icon={<UsersRound />} label="V procesu" value={myPhases.filter((phase) => phase.status === "in_progress").length} tone="green" />
          <MetricCard icon={<Bot />} label="Končano" value={myPhases.filter((phase) => phase.status === "completed").length} tone="red" />
        </section>

        <section className="workerDashboardGrid">
          <div className="surface">
            <div className="sectionHeader"><h2>Moji delovni nalogi</h2><span>{myWorkOrders.length}</span></div>
            <div className="entityList">
              {myWorkOrders.map((order) => (
                <div className="entityItem" key={order._id}>
                  <div>
                    <strong>{order.code}</strong>
                    <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                    <p>Rok: {formatDate(order.dueDate)} / {order.orderId?.customerName || "stranka ni vnesena"}</p>
                  </div>
                  <StatusBadge value={order.status} />
                </div>
              ))}
              {myWorkOrders.length === 0 && <EmptyState label="Ni dodeljenih nalogov" />}
            </div>
          </div>

          <div className="surface">
            <div className="sectionHeader"><h2>Moje faze</h2><span>{myPhases.length}</span></div>
            <div className="entityList">
              {myPhases.map((phase) => (
                <div className="entityItem workerPhaseItem" key={phase._id}>
                  <div>
                    <strong>{phase.workOrderId?.code || "WO"} / {phase.name}</strong>
                    <span>{phase.requiredSkill} / {formatDate(phase.start)} - {formatDate(phase.end)}</span>
                  </div>
                  <label>
                    Status
                    <select value={phase.status} onChange={(event) => updateMyPhaseStatus(phase, event.target.value)} disabled={loadingPhase === phase._id}>
                      <option value="planned">planned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="completed">completed</option>
                    </select>
                  </label>
                  <StatusBadge value={phase.status} />
                </div>
              ))}
              {myPhases.length === 0 && <EmptyState label="Ni dodeljenih faz" />}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>Smart Production Workflow</h1>
        </div>
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
        <WorkOrdersTable workOrders={dashboardWorkOrders} />
        <InventoryPanel inventory={inventory} />
        <TimelinePanel timeline={timeline} />
        <WorkloadPanel employees={employees} />
      </section>
    </main>
  );
}
