import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { label } from "../utils/i18n.js";

function todayInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
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

function overlapHours(phase, range) {
  const start = new Date(phase.start);
  const end = new Date(phase.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;

  const clippedStart = Math.max(start.getTime(), range.start.getTime());
  const clippedEnd = Math.min(end.getTime(), range.end.getTime());
  return Math.max(0, (clippedEnd - clippedStart) / 36e5);
}

function isEmployeePhase(employee, phase) {
  return String(phase.assignedTo || "") === String(employee.id) || phase.assignedToName === employee.name;
}

export function WorkloadPanel({ employees, phases = [], selectedIds = [], onEmployeeClick }) {
  const [mode, setMode] = useState("week");
  const [date, setDate] = useState(todayInput());
  const [search, setSearch] = useState("");
  const range = useMemo(() => getRange(mode, date), [mode, date]);
  const filteredEmployees = useMemo(() => employees.map((employee) => {
    const assigned = phases.filter((phase) => isEmployeePhase(employee, phase));
    const matched = assigned
      .map((phase) => ({ phase, hours: overlapHours(phase, range) }))
      .filter((item) => item.hours > 0);
    const hours = matched.reduce((sum, item) => sum + item.hours, 0);

    return {
      ...employee,
      hours: Math.round(hours * 10) / 10,
      phaseCount: matched.length
    };
  }).filter((employee) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [employee.name, employee.skills?.join(" "), employee.hours, employee.phaseCount].join(" ").toLowerCase().includes(query);
  }), [employees, phases, range, search]);
  const maxHours = mode === "week" ? 40 : 8;

  return (
    <div className="surface workload">
      <div className="sectionHeader workloadHeader">
        <h2>{label("workload")}</h2>
        <div className="workloadHeaderControls">
          <div className="rangeControls">
            <button type="button" className={mode === "week" ? "selected" : ""} onClick={() => setMode("week")}>{label("week")}</button>
            <button type="button" className={mode === "day" ? "selected" : ""} onClick={() => setMode("day")}>{label("day")}</button>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <span>{label("hoursPhases")}</span>
        </div>
      </div>
      <label className="searchField compactSearch">
        <Search size={17} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchEmployees")} />
      </label>
      <div className="workloadList">
        {filteredEmployees.map((employee) => (
          <button
            type="button"
            className={`workloadItem dashboardClickableRow ${selectedIds.includes(String(employee.id)) ? "selectedFilterItem" : ""}`}
            key={employee.id}
            onClick={() => onEmployeeClick?.(employee)}
          >
            <div>
              <strong>{employee.name}</strong>
              <span>{employee.skills?.join(", ") || label("noData")}</span>
            </div>
            <div className="barTrack">
              <div style={{ width: `${Math.min(100, (employee.hours / maxHours) * 100)}%` }} />
            </div>
            <div className="workloadMetric">
              <strong>{employee.hours}h</strong>
              <span>{employee.phaseCount} {label("phasesShort")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
