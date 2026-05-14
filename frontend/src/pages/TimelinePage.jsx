import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel } from "../utils/i18n.js";

const STATUSES = ["planned", "in_progress", "completed"];

function getCurrentWeekRange() {
  const start = new Date();
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function overlapsRange(phase, range) {
  const start = new Date(phase.start);
  const end = new Date(phase.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
  return start < range.end && end > range.start;
}

function phasePayload(phase, status) {
  return {
    id: phase._id,
    name: phase.name,
    requiredSkill: phase.requiredSkill,
    assignedTo: phase.assignedTo?._id || phase.assignedTo || "",
    assignedToName: phase.assignedToName,
    start: phase.start,
    end: phase.end,
    dependsOn: phase.dependsOn,
    status
  };
}

function matchesSelection(phase, selectedWorkOrders, selectedEmployees) {
  const workOrderId = String(phase.workOrderId?._id || phase.workOrderId);
  const matchesWorkOrder = selectedWorkOrders.length === 0 || selectedWorkOrders.includes(workOrderId);
  const matchesEmployee = selectedEmployees.length === 0 || selectedEmployees.some((employee) =>
    String(phase.assignedTo || "") === String(employee.id) || phase.assignedToName === employee.name
  );
  return matchesWorkOrder && matchesEmployee;
}

function isEmployeePhase(employee, phase, user) {
  if (!employee && !user) return false;
  const employeeId = employee?._id || employee?.id;
  const assignedId = phase.assignedTo?._id || phase.assignedTo;
  return (
    (employeeId && assignedId && String(assignedId) === String(employeeId)) ||
    phase.assignedToName === employee?.name ||
    phase.assignedToName === user?.name
  );
}

export function TimelinePage({ session, dataRefreshKey }) {
  const isAdmin = session.user?.role === "admin";
  const [workOrders, setWorkOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [phases, setPhases] = useState([]);
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dateScope, setDateScope] = useState("week");
  const [selectedWorkOrders, setSelectedWorkOrders] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [error, setError] = useState("");
  const [loadingPhase, setLoadingPhase] = useState(null);
  const [draggingPhaseId, setDraggingPhaseId] = useState(null);

  async function loadPageData() {
    const [workOrderData, employeeData, phaseData] = await Promise.all([
      api.workOrders(),
      api.employees(),
      api.workOrderPhases()
    ]);
    setWorkOrders(workOrderData);
    setEmployees(employeeData);
    setPhases(phaseData);
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, [dataRefreshKey]);

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => [employee.name, employee.skills?.join(" ")].join(" ").toLowerCase().includes(query));
  }, [employees, employeeSearch]);

  const selectedEmployeeFilters = useMemo(
    () => isAdmin ? employees.filter((employee) => selectedEmployees.includes(String(employee._id))) : [],
    [employees, selectedEmployees, isAdmin]
  );
  const currentEmployee = useMemo(
    () => employees.find((employee) => String(employee.userId || "") === String(session.user?.id) || employee.name === session.user?.name),
    [employees, session.user?.id, session.user?.name]
  );
  const accessiblePhases = useMemo(
    () => isAdmin ? phases : phases.filter((phase) => isEmployeePhase(currentEmployee, phase, session.user)),
    [phases, isAdmin, currentEmployee, session.user]
  );
  const accessibleWorkOrderIds = useMemo(
    () => new Set(accessiblePhases.map((phase) => String(phase.workOrderId?._id || phase.workOrderId))),
    [accessiblePhases]
  );
  const filteredWorkOrders = useMemo(() => {
    const query = workOrderSearch.trim().toLowerCase();
    const source = isAdmin
      ? workOrders
      : workOrders.filter((order) => accessibleWorkOrderIds.has(String(order._id)));
    if (!query) return source;
    return source.filter((order) => [order.code, order.status, order.items?.map((item) => item.productName).join(" ")].join(" ").toLowerCase().includes(query));
  }, [workOrders, workOrderSearch, isAdmin, accessibleWorkOrderIds]);
  const currentWeekRange = useMemo(() => getCurrentWeekRange(), []);
  const visiblePhases = useMemo(
    () => accessiblePhases.filter((phase) =>
      matchesSelection(phase, selectedWorkOrders, selectedEmployeeFilters) &&
      (dateScope === "all" || overlapsRange(phase, currentWeekRange))
    ),
    [accessiblePhases, selectedWorkOrders, selectedEmployeeFilters, dateScope, currentWeekRange]
  );

  function toggleWorkOrder(id) {
    setSelectedWorkOrders((current) => current.includes(String(id))
      ? current.filter((item) => item !== String(id))
      : [...current, String(id)]
    );
  }

  function toggleEmployee(id) {
    setSelectedEmployees((current) => current.includes(String(id))
      ? current.filter((item) => item !== String(id))
      : [...current, String(id)]
    );
  }

  async function updatePhaseStatus(phase, status) {
    if (phase.status === status) return;
    setError("");
    setLoadingPhase(phase._id);

    try {
      await api.updateWorkOrderPhase(phase._id, phasePayload(phase, status), session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPhase(null);
    }
  }

  function handlePhaseDragStart(event, phase) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", phase._id);
    setDraggingPhaseId(phase._id);
  }

  function handleColumnDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleColumnDrop(event, status) {
    event.preventDefault();
    const phaseId = event.dataTransfer.getData("text/plain") || draggingPhaseId;
    const phase = phases.find((item) => item._id === phaseId);
    setDraggingPhaseId(null);
    if (!phase || loadingPhase === phase._id) return;
    updatePhaseStatus(phase, status);
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>{label("timeline")}</h1>
          <p>{label("timelineSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className={`surface noTopMargin timelineFilterPanel ${isAdmin ? "" : "timelineFilterPanelSingle"}`}>
        <div className="timelineFilterGroup">
          <div className="sectionHeader compact">
            <h2>{label("workOrders")}</h2>
            <span>{selectedWorkOrders.length} {label("selected")}</span>
          </div>
          <label className="searchField compactSearch">
            <Search size={17} />
            <input value={workOrderSearch} onChange={(event) => setWorkOrderSearch(event.target.value)} placeholder={label("searchWorkOrders")} />
          </label>
          <div className="filterChipList">
            {filteredWorkOrders.map((order) => (
              <button
                type="button"
                className={selectedWorkOrders.includes(String(order._id)) ? "selected" : ""}
                key={order._id}
                onClick={() => toggleWorkOrder(order._id)}
              >
                {order.code}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && <div className="timelineFilterGroup">
          <div className="sectionHeader compact">
            <h2>{label("employees")}</h2>
            <span>{selectedEmployees.length} {label("selected")}</span>
          </div>
          <label className="searchField compactSearch">
            <Search size={17} />
            <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={label("searchEmployees")} />
          </label>
          <div className="filterChipList">
            {filteredEmployees.map((employee) => (
              <button
                type="button"
                className={selectedEmployees.includes(String(employee._id)) ? "selected" : ""}
                key={employee._id}
                onClick={() => toggleEmployee(employee._id)}
              >
                {employee.name}
              </button>
            ))}
          </div>
        </div>}
      </section>

      <div className="timelineScopeBar">
        <span>{label("period")}</span>
        <div className="rangeControls timelineScopeButtons">
          <button type="button" className={dateScope === "all" ? "selected" : ""} onClick={() => setDateScope("all")}>
            {label("allDates")}
          </button>
          <button type="button" className={dateScope === "week" ? "selected" : ""} onClick={() => setDateScope("week")}>
            {label("thisWeek")}
          </button>
        </div>
      </div>

      <section className="timelineBoard">
        {STATUSES.map((status) => {
          const columnPhases = visiblePhases.filter((phase) => phase.status === status);
          const draggingPhase = phases.find((phase) => phase._id === draggingPhaseId);
          const canDropHere = draggingPhase && draggingPhase.status !== status;

          return (
            <div
              className={`timelineStatusColumn ${status} ${canDropHere ? "dropReady" : ""}`}
              key={status}
              onDragOver={handleColumnDragOver}
              onDrop={(event) => handleColumnDrop(event, status)}
            >
              <div className="sectionHeader compact">
                <h2>{statusLabel(status)}</h2>
                <span>{columnPhases.length}</span>
              </div>
              <div className="timelineStatusList">
                {columnPhases.map((phase) => (
                  <article
                    className={`timelinePhaseCard ${draggingPhaseId === phase._id ? "dragging" : ""}`}
                    draggable={loadingPhase !== phase._id}
                    key={phase._id}
                    onDragStart={(event) => handlePhaseDragStart(event, phase)}
                    onDragEnd={() => setDraggingPhaseId(null)}
                  >
                    <div>
                      <strong>{phase.workOrderId?.code || "WO"} / {phase.name}</strong>
                      <span>{phase.assignedToName || label("noData")} / {phase.requiredSkill}</span>
                      <p>{formatDate(phase.start)} - {formatDate(phase.end)}</p>
                      {(phase.actualStartedAt || phase.actualCompletedAt) && (
                        <p>
                          {phase.actualStartedAt ? `${label("actualStarted")}: ${formatDate(phase.actualStartedAt)}` : ""}
                          {phase.actualStartedAt && phase.actualCompletedAt ? " / " : ""}
                          {phase.actualCompletedAt ? `${label("actualCompleted")}: ${formatDate(phase.actualCompletedAt)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="phaseStatusActions">
                      {STATUSES.map((candidate) => (
                        <button
                          type="button"
                          className={candidate === phase.status ? "selected" : ""}
                          key={candidate}
                          onClick={() => updatePhaseStatus(phase, candidate)}
                          disabled={loadingPhase === phase._id}
                        >
                          {statusLabel(candidate)}
                        </button>
                      ))}
                    </div>
                    <StatusBadge value={phase.status} />
                  </article>
                ))}
                {columnPhases.length === 0 && <EmptyState label={label("noPhases")} />}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
