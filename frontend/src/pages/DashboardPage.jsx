import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Filter, Hammer, PackageCheck, Search, ShoppingCart, UsersRound } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { InventoryPanel } from "../components/InventoryPanel.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { TimelinePanel } from "../components/TimelinePanel.jsx";
import { WorkOrderDetailModal } from "../components/WorkOrderDetailModal.jsx";
import { WorkloadPanel } from "../components/WorkloadPanel.jsx";
import { WorkOrdersTable } from "../components/WorkOrdersTable.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel } from "../utils/i18n.js";

const WORKER_PHASE_STATUS_OPTIONS = [
  { value: "all", labelKey: "allStatuses" },
  { value: "planned" },
  { value: "in_progress" },
  { value: "completed" }
];

function dateInput(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function todayInput() {
  return dateInput(new Date());
}

function getRange(mode, value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (mode === "week") {
    const start = new Date(date);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function overlapsRange(phase, range) {
  const start = new Date(phase.start);
  const end = new Date(phase.end);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < range.end && end > range.start;
}

function WorkerPhaseStatusMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = WORKER_PHASE_STATUS_OPTIONS.find((option) => option.value === value) || WORKER_PHASE_STATUS_OPTIONS[0];
  const currentLabel = current.labelKey ? label(current.labelKey) : statusLabel(current.value);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="statusFilterControl workerStatusMenu" ref={ref}>
      <button type="button" className="statusFilterButton" onClick={() => setOpen((isOpen) => !isOpen)} aria-label="Filter statusa mojih faz">
        <Filter size={15} />
        <span>{currentLabel}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="statusFilterMenu">
          {WORKER_PHASE_STATUS_OPTIONS.map((option) => (
            <button
              type="button"
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.labelKey ? label(option.labelKey) : statusLabel(option.value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage({ session, dataRefreshKey }) {
  const [dashboard, setDashboard] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [phases, setPhases] = useState([]);
  const [timelineFilters, setTimelineFilters] = useState([]);
  const [selectedWorkerWorkOrderId, setSelectedWorkerWorkOrderId] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [workerPhaseSearch, setWorkerPhaseSearch] = useState("");
  const [workerPhaseStatus, setWorkerPhaseStatus] = useState("all");
  const [workerPhaseMode, setWorkerPhaseMode] = useState("all");
  const [workerPhaseDate, setWorkerPhaseDate] = useState(todayInput());
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
  }, [session, dataRefreshKey]);

  const timeline = useMemo(() => dashboard?.phases || [], [dashboard]);
  const inventory = dashboard?.inventory || [];
  const employees = dashboard?.employees || [];
  const dashboardWorkOrders = dashboard?.workOrders || [];
  const dashboardPhases = dashboard?.phases || [];
  const activities = dashboard?.activities || [];
  const fulfillmentStats = dashboard?.fulfillmentStats || { completedProducts: 0, issuedProducts: 0 };
  const myPhases = useMemo(() => phases.filter((phase) => phase.assignedToName === session?.user?.name), [phases, session?.user?.name]);
  const myWorkOrderIds = useMemo(() => new Set(myPhases.map((phase) => String(phase.workOrderId?._id || phase.workOrderId))), [myPhases]);
  const myWorkOrders = useMemo(() => workOrders.filter((order) => myWorkOrderIds.has(String(order._id))), [workOrders, myWorkOrderIds]);
  const selectedWorkerWorkOrder = selectedWorkerWorkOrderId ? myWorkOrders.find((order) => order._id === selectedWorkerWorkOrderId) : null;
  const workerPhaseRange = useMemo(
    () => workerPhaseMode === "all" ? null : getRange(workerPhaseMode, workerPhaseDate),
    [workerPhaseMode, workerPhaseDate]
  );
  const filteredMyPhases = useMemo(() => {
    const query = workerPhaseSearch.trim().toLowerCase();
    return myPhases.filter((phase) => {
      const matchesStatus = workerPhaseStatus === "all" || phase.status === workerPhaseStatus;
      const matchesDate = !workerPhaseRange || overlapsRange(phase, workerPhaseRange);
      const text = [
        phase.workOrderId?.code,
        phase.name,
        phase.requiredSkill,
        phase.status,
        formatDate(phase.start),
        formatDate(phase.end)
      ].join(" ").toLowerCase();
      return matchesStatus && matchesDate && (!query || text.includes(query));
    });
  }, [myPhases, workerPhaseSearch, workerPhaseStatus, workerPhaseRange]);
  const selectedWorkOrderIds = useMemo(
    () => timelineFilters.filter((filter) => filter.type === "workOrder").map((filter) => String(filter.id)),
    [timelineFilters]
  );
  const selectedEmployeeIds = useMemo(
    () => timelineFilters.filter((filter) => filter.type === "employee").map((filter) => String(filter.id)),
    [timelineFilters]
  );

  function toggleTimelineFilter(nextFilter) {
    setTimelineFilters((current) => {
      const exists = current.some((filter) => filter.type === nextFilter.type && String(filter.id) === String(nextFilter.id));
      if (exists) {
        return current.filter((filter) => !(filter.type === nextFilter.type && String(filter.id) === String(nextFilter.id)));
      }
      return [...current, nextFilter];
    });
  }

  async function saveWorkerPhaseEdit() {
    if (!editingPhase) return;
    setError("");
    setLoadingPhase(editingPhase.id);
    try {
      await api.updateWorkOrderPhase(editingPhase.id, { status: editingPhase.status }, session.token);
      setEditingPhase(null);
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
            <h1>{label("dashboard")}</h1>
            <p>{label("assignedPhases")}</p>
          </div>
        </header>

        {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

        <section className="metrics">
          <MetricCard icon={<Hammer />} label={label("myWorkOrdersMetric")} value={myWorkOrders.length} tone="blue" />
          <MetricCard icon={<PackageCheck />} label={label("myPhases")} value={myPhases.length} tone="amber" />
          <MetricCard icon={<UsersRound />} label={statusLabel("in_progress")} value={myPhases.filter((phase) => phase.status === "in_progress").length} tone="green" />
          <MetricCard icon={<Bot />} label={statusLabel("completed")} value={myPhases.filter((phase) => phase.status === "completed").length} tone="red" />
        </section>

        <section className="workerDashboardGrid">
          <div className="surface">
            <div className="sectionHeader"><h2>{label("myWorkOrders")}</h2><span>{myWorkOrders.length}</span></div>
            <div className="entityList">
              {myWorkOrders.map((order) => (
                <button
                  type="button"
                  className="entityItem productEntity dashboardClickableRow"
                  key={order._id}
                  onClick={() => setSelectedWorkerWorkOrderId(order._id)}
                >
                  <div>
                    <strong>{order.code}</strong>
                    <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                    <p>{label("deadline")}: {formatDate(order.dueDate)} / {order.orderId?.customerName || label("noData")}</p>
                  </div>
                  <StatusBadge value={order.status} />
                </button>
              ))}
              {myWorkOrders.length === 0 && <EmptyState label={label("noAssignedWorkOrders")} />}
            </div>
          </div>

          <div className="surface">
            <div className="sectionHeader"><h2>{label("myPhases")}</h2><span>{filteredMyPhases.length} / {myPhases.length}</span></div>
            <div className="workerPhaseTools">
              <label className="searchField compactSearch">
                <Search size={17} />
                <input value={workerPhaseSearch} onChange={(event) => setWorkerPhaseSearch(event.target.value)} placeholder={label("searchPhases")} />
              </label>
              <WorkerPhaseStatusMenu value={workerPhaseStatus} onChange={setWorkerPhaseStatus} />
              <div className="rangeControls workerPhaseDateFilter">
                <button type="button" className={workerPhaseMode === "all" ? "selected" : ""} onClick={() => setWorkerPhaseMode("all")}>{label("all")}</button>
                <button type="button" className={workerPhaseMode === "week" ? "selected" : ""} onClick={() => setWorkerPhaseMode("week")}>{label("week")}</button>
                <button type="button" className={workerPhaseMode === "day" ? "selected" : ""} onClick={() => setWorkerPhaseMode("day")}>{label("day")}</button>
                {workerPhaseMode !== "all" && <input type="date" value={workerPhaseDate} onChange={(event) => setWorkerPhaseDate(event.target.value)} />}
              </div>
            </div>
            <div className="entityList">
              {filteredMyPhases.map((phase) => (
                <div className="entityItem workerPhaseItem" key={phase._id}>
                  <div>
                    <strong>{phase.workOrderId?.code || "WO"} / {phase.name}</strong>
                    <span>{phase.requiredSkill} / {formatDate(phase.start)} - {formatDate(phase.end)}</span>
                  </div>
                  <StatusBadge value={phase.status} />
                </div>
              ))}
              {filteredMyPhases.length === 0 && <EmptyState label={label("noAssignedPhases")} />}
            </div>
          </div>
        </section>
        <WorkOrderDetailModal
          order={selectedWorkerWorkOrder}
          phases={phases}
          employees={[]}
          session={session}
          isAdmin={false}
          editingPhase={editingPhase}
          setEditingPhase={setEditingPhase}
          savePhaseEdit={saveWorkerPhaseEdit}
          loading={Boolean(loadingPhase)}
          onClose={() => { setSelectedWorkerWorkOrderId(null); setEditingPhase(null); }}
        />
      </main>
    );
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>{label("dashboardTitle")}</h1>
        </div>
      </header>

      {error && (
        <div className="alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <section className="metrics">
        <MetricCard icon={<Hammer />} label={label("activeOrders")} value={dashboard?.activeWorkOrders ?? "-"} tone="blue" />
        <MetricCard icon={<PackageCheck />} label={label("lowStock")} value={dashboard?.lowStock?.length ?? "-"} tone="amber" />
        <MetricCard icon={<UsersRound />} label={label("employees")} value={employees.length || "-"} tone="green" />
        <MetricCard icon={<CheckCircle2 />} label={label("completedProducts")} value={fulfillmentStats.completedProducts ?? 0} tone="blue" />
        <MetricCard icon={<ShoppingCart />} label={label("issuedProducts")} value={fulfillmentStats.issuedProducts ?? 0} tone="green" />
        <MetricCard icon={<Bot />} label={label("llmActions")} value={activities.length || "-"} tone="red" />
      </section>

      <section className="workspaceGrid">
        <WorkOrdersTable
          workOrders={dashboardWorkOrders}
          selectedIds={selectedWorkOrderIds}
          onWorkOrderClick={(order) => toggleTimelineFilter({ type: "workOrder", id: order._id, label: order.code })}
        />
        <InventoryPanel inventory={inventory} />
        <TimelinePanel
          timeline={timeline}
          contextFilters={timelineFilters}
          onClearContextFilters={() => setTimelineFilters([])}
        />
        <WorkloadPanel
          employees={employees}
          phases={dashboardPhases}
          selectedIds={selectedEmployeeIds}
          onEmployeeClick={(employee) => toggleTimelineFilter({ type: "employee", id: employee.id, name: employee.name, label: employee.name })}
        />
      </section>
    </main>
  );
}
