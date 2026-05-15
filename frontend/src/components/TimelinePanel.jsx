import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Filter, List, X } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label, statusLabel, phaseColor } from "../utils/i18n.js";

const STATUS_OPTIONS = ["planned", "in_progress", "completed"];

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

function shiftDate(value, mode, direction) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  date.setDate(date.getDate() + (mode === "week" ? 7 : 1) * direction);
  return dateInput(date);
}

function overlapsRange(phase, range) {
  const start = new Date(phase.start);
  const end = new Date(phase.end);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < range.end && end > range.start;
}


function axisTicks(mode, range) {
  if (mode === "week") {
    return Array.from({ length: 7 }, (_item, index) => {
      const date = new Date(range.start);
      date.setDate(date.getDate() + index);
      return {
        label: date.toLocaleDateString("sl-SI", { weekday: "short", day: "2-digit" }),
        left: `${(index / 6) * 100}%`
      };
    });
  }

  return Array.from({ length: 7 }, (_item, index) => {
    const hour = index * 4;
    return { label: `${String(hour).padStart(2, "0")}:00`, left: `${(index / 6) * 100}%` };
  });
}

function phaseMatchesContext(phase, contextFilters = []) {
  if (!contextFilters.length) return true;
  const workOrderFilters = contextFilters.filter((filter) => filter.type === "workOrder");
  const employeeFilters = contextFilters.filter((filter) => filter.type === "employee");
  const matchesWorkOrder = workOrderFilters.length === 0 || workOrderFilters.some((filter) =>
    String(phase.workOrderId?._id || phase.workOrderId) === String(filter.id)
  );
  const matchesEmployee = employeeFilters.length === 0 || employeeFilters.some((filter) =>
    String(phase.assignedTo || "") === String(filter.id) || phase.assignedToName === filter.name
  );
  return matchesWorkOrder && matchesEmployee;
}

function loadDefaultTimelineView() {
  const saved = localStorage.getItem("spw-dashboard-timeline-view");
  return saved === "chart" ? "chart" : "list";
}

function StatusFilterMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [{ value: "all", label: label("allStatuses") }, ...STATUS_OPTIONS.map((status) => ({ value: status, label: statusLabel(status) }))];
  const current = options.find((option) => option.value === value)?.label || label("allStatuses");

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
    <div className="statusFilterControl" ref={ref}>
      <button type="button" className="statusFilterButton" onClick={() => setOpen((currentOpen) => !currentOpen)} aria-label="Filter statusa faz">
        <Filter size={15} />
        <span>{current}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="statusFilterMenu">
          {options.map((option) => (
            <button
              type="button"
              className={`${option.value !== "all" ? `phaseOpt ${option.value}` : ""} ${option.value === value ? "selected" : ""}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.value !== "all" && <span className={`phaseIndicator ${option.value}`} />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function filterLabel(contextFilters = []) {
  if (!contextFilters.length) return "";
  const workOrders = contextFilters.filter((filter) => filter.type === "workOrder").map((filter) => filter.label);
  const employees = contextFilters.filter((filter) => filter.type === "employee").map((filter) => filter.label);
  const parts = [];
  if (workOrders.length) parts.push(`${label("workOrdersList").toLowerCase()}: ${workOrders.join(", ")}`);
  if (employees.length) parts.push(`${label("employees").toLowerCase()}: ${employees.join(", ")}`);
  return parts.join(" / ");
}

function rangeLabel(mode, range) {
  if (mode === "week") {
    const end = new Date(range.end);
    end.setDate(end.getDate() - 1);
    return `${range.start.toLocaleDateString("sl-SI")} - ${end.toLocaleDateString("sl-SI")}`;
  }
  return range.start.toLocaleDateString("sl-SI");
}

export function TimelinePanel({ timeline, contextFilters = [], onClearContextFilters, showClear = true }) {
  const [view, setView] = useState(loadDefaultTimelineView);
  const [mode, setMode] = useState("week");
  const [date, setDate] = useState(todayInput());
  const [statusFilter, setStatusFilter] = useState("all");
  const range = useMemo(() => getRange(mode, date), [mode, date]);
  const filteredTimeline = useMemo(
    () => timeline.filter((phase) =>
      phaseMatchesContext(phase, contextFilters)
      && overlapsRange(phase, range)
      && (statusFilter === "all" || phase.status === statusFilter)
    ),
    [timeline, contextFilters, range, statusFilter]
  );
  const ticks = useMemo(() => axisTicks(mode, range), [mode, range]);
  const activeFilterLabel = filterLabel(contextFilters);

  return (
    <div className="surface timeline">
      <div className="sectionHeader">
        <div>
          <h2>{label("timelinePhases")}</h2>
        </div>
        <div className="timelineHeaderActions">
          <StatusFilterMenu value={statusFilter} onChange={setStatusFilter} />
          <div className="rangeControls">
            <button type="button" className={mode === "week" ? "selected" : ""} onClick={() => setMode("week")}>{label("week")}</button>
            <button type="button" className={mode === "day" ? "selected" : ""} onClick={() => setMode("day")}>{label("day")}</button>
            <button type="button" aria-label="Prejsnje obdobje" onClick={() => setDate(shiftDate(date, mode, -1))}><ChevronLeft size={15} /></button>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            <button type="button" aria-label="Naslednje obdobje" onClick={() => setDate(shiftDate(date, mode, 1))}><ChevronRight size={15} /></button>
          </div>
          <button type="button" className="iconText" onClick={() => setView(view === "list" ? "chart" : "list")}>
            {view === "list" ? <BarChart3 size={16} /> : <List size={16} />}
            {view === "list" ? label("graph") : label("list")}
          </button>
        </div>
      </div>
      <div className="timelineFilterRow">
        <span className="filterCount">{filteredTimeline.length} {label("countFiltered")} / {timeline.length} {label("countTotal")}</span>
        {activeFilterLabel && <p className="filterHint">Filter: {activeFilterLabel}</p>}
        {showClear && contextFilters.length > 0 && (
          <button type="button" className="iconText compactButton" onClick={onClearContextFilters}>
            <X size={15} />
            {label("clear")}
          </button>
        )}
      </div>
      <div className="timelineRangeLabel">{mode === "week" ? "Ponedeljek - nedelja" : "Izbran dan"} / {rangeLabel(mode, range)}</div>

      {view === "list" ? (
        <div className="timelineList">
          {filteredTimeline.map((phase) => (
            <div className={`phaseItem phaseColorItem phase-status-${phase.status}`} key={phase._id} style={{ "--phase-color": phaseColor(phase.name) }}>
              <div className="phaseTime">
                <span>↑ {formatDate(phase.start)}</span>
                <span>↓ {formatDate(phase.end)}</span>
              </div>
              <div className="phaseBody">
                <strong>{phase.workOrderId?.code || "WO"} / {phase.name}</strong>
                <span><b>{phase.assignedToName || label("noData")}</b> / {phase.requiredSkill}</span>
                {(phase.actualStartedAt || phase.actualCompletedAt) && (
                  <span>
                    {phase.actualStartedAt ? `${label("actualStarted")}: ${formatDate(phase.actualStartedAt)}` : ""}
                    {phase.actualStartedAt && phase.actualCompletedAt ? " / " : ""}
                    {phase.actualCompletedAt ? `${label("actualCompleted")}: ${formatDate(phase.actualCompletedAt)}` : ""}
                  </span>
                )}
              </div>
              <StatusBadge value={phase.status} />
            </div>
          ))}
          {filteredTimeline.length === 0 && <EmptyState label={label("noPhases")} />}
        </div>
      ) : (
        <div className="timelineGraph">
          <div className="timelineAxis">
            {ticks.map((tick) => (
              <span key={tick.label} style={{ left: tick.left }}>{tick.label}</span>
            ))}
          </div>
          <div className="timelineChart">
            {filteredTimeline.map((phase) => {
              const start = new Date(phase.start);
              const end = new Date(phase.end);
              const span = Math.max(1, range.end.getTime() - range.start.getTime());
              const left = Math.max(0, ((start.getTime() - range.start.getTime()) / span) * 100);
              const right = Math.min(100, ((end.getTime() - range.start.getTime()) / span) * 100);
              const width = Math.max(3, right - left);

              return (
                <div className={`timelineBarRow graphRow phase-status-${phase.status}`} key={phase._id} style={{ "--phase-color": phaseColor(phase.name) }}>
                  <div>
                    <strong>{phase.workOrderId?.code || "WO"} / {phase.name}</strong>
                    <span>{phase.assignedToName || label("noData")}</span>
                    {(phase.actualStartedAt || phase.actualCompletedAt) && (
                      <span>
                        {phase.actualStartedAt ? `${label("actualStarted")}: ${formatDate(phase.actualStartedAt)}` : ""}
                        {phase.actualStartedAt && phase.actualCompletedAt ? " / " : ""}
                        {phase.actualCompletedAt ? `${label("actualCompleted")}: ${formatDate(phase.actualCompletedAt)}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="timelineBarTrack">
                    <span
                      className={`timelineBar ${phase.status}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.min(width, 100 - left)}%`,
                        background: phaseColor(phase.name)
                      }}
                    />
                  </div>
                  <span>{formatDate(phase.start)} - {formatDate(phase.end)}</span>
                </div>
              );
            })}
            {filteredTimeline.length === 0 && <EmptyState label={label("noData")} />}
          </div>
        </div>
      )}
    </div>
  );
}
