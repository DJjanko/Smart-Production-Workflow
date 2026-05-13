import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, List, Search } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";
import { label } from "../utils/i18n.js";

function currentMonthInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 7);
}

function currentYearInput() {
  return String(new Date().getFullYear());
}

function periodRange(mode, monthValue, yearValue) {
  if (mode === "year") {
    const year = Number(yearValue) || new Date().getFullYear();
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }

  return monthRange(monthValue);
}

function monthRange(value) {
  const [year, month] = (value || currentMonthInput()).split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function shiftPeriod(mode, monthValue, yearValue, direction) {
  if (mode === "year") {
    return { month: monthValue, year: String((Number(yearValue) || new Date().getFullYear()) + direction) };
  }

  return { month: shiftMonth(monthValue, direction), year: yearValue };
}

function shiftMonth(value, direction) {
  const [year, month] = (value || currentMonthInput()).split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 7);
}

function orderOverlapsPeriod(order, range) {
  const start = new Date(order.startDate || order.createdAt || order.dueDate);
  const end = new Date(order.dueDate || order.startDate || order.createdAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
  return start < range.end && end > range.start;
}

function periodTicks(mode, range) {
  if (mode === "year") {
    return Array.from({ length: 12 }, (_item, index) => ({
      label: new Date(range.start.getFullYear(), index, 1).toLocaleDateString("sl-SI", { month: "short" }),
      left: `${(index / 11) * 100}%`
    }));
  }

  const days = Math.round((range.end - range.start) / 86400000);
  const step = days > 30 ? 5 : 4;
  const ticks = [];
  for (let day = 1; day <= days; day += step) {
    ticks.push({ label: String(day), left: `${((day - 1) / days) * 100}%` });
  }
  if (ticks[ticks.length - 1]?.label !== String(days)) {
    ticks.push({ label: String(days), left: "100%" });
  }
  return ticks;
}

function loadDefaultWorkOrdersView() {
  const saved = localStorage.getItem("spw-dashboard-workorders-view");
  return saved === "chart" ? "chart" : "list";
}

export function WorkOrdersTable({ workOrders, selectedIds = [], onWorkOrderClick }) {
  const [view, setView] = useState(loadDefaultWorkOrdersView);
  const [periodMode, setPeriodMode] = useState("month");
  const [month, setMonth] = useState(currentMonthInput());
  const [year, setYear] = useState(currentYearInput());
  const range = useMemo(() => periodRange(periodMode, month, year), [periodMode, month, year]);
  const ticks = useMemo(() => periodTicks(periodMode, range), [periodMode, range]);
  const [search, setSearch] = useState("");
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return workOrders.filter((order) => {
      const matchesPeriod = orderOverlapsPeriod(order, range);
      if (!matchesPeriod) return false;
      if (!query) return true;

      return [
        order.code,
        order.status,
        order.items?.map((item) => `${item.quantity} ${item.productName}`).join(" ")
      ].join(" ").toLowerCase().includes(query);
    });
  }, [workOrders, range, search]);
  const span = Math.max(1, range.end.getTime() - range.start.getTime());

  function movePeriod(direction) {
    const next = shiftPeriod(periodMode, month, year, direction);
    setMonth(next.month);
    setYear(next.year);
  }

  return (
    <div className="surface workOrders">
      <div className="sectionHeader">
        <h2>{label("workOrders")}</h2>
        <div className="timelineHeaderActions">
          <span>{filteredOrders.length} / {workOrders.length}</span>
          <div className="rangeControls monthControl">
            <button type="button" className={periodMode === "month" ? "selected" : ""} onClick={() => setPeriodMode("month")}>{label("month")}</button>
            <button type="button" className={periodMode === "year" ? "selected" : ""} onClick={() => setPeriodMode("year")}>{label("year")}</button>
            <button type="button" aria-label="Prejsnje obdobje" onClick={() => movePeriod(-1)}><ChevronLeft size={15} /></button>
            {periodMode === "month" ? (
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            ) : (
              <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
            )}
            <button type="button" aria-label="Naslednje obdobje" onClick={() => movePeriod(1)}><ChevronRight size={15} /></button>
          </div>
          <button type="button" className="iconText" onClick={() => setView(view === "list" ? "chart" : "list")}>
            {view === "list" ? <BarChart3 size={16} /> : <List size={16} />}
            {view === "list" ? label("graph") : label("list")}
          </button>
        </div>
      </div>
      <label className="searchField compactSearch">
        <Search size={17} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchWorkOrders")} />
      </label>

      {view === "list" ? (
        <div className="table">
          <div className="row head">
            <span>Koda</span>
            <span>{label("products")}</span>
            <span>{label("status")}</span>
            <span>{label("deadline")}</span>
          </div>
          {filteredOrders.map((order) => (
            <button
              type="button"
              className={`row dashboardClickableRow ${selectedIds.includes(String(order._id)) ? "selectedFilterItem" : ""}`}
              key={order._id}
              onClick={() => onWorkOrderClick?.(order)}
            >
              <strong>{order.code}</strong>
              <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
              <StatusBadge value={order.status} />
              <span>{formatDate(order.dueDate)}</span>
            </button>
          ))}
          {filteredOrders.length === 0 && <EmptyState label={label("noResults")} />}
        </div>
      ) : (
        <div className="timelineGraph">
          <div className="timelineAxis monthAxis">
            {ticks.map((tick, index) => (
              <span key={`${tick.label}-${index}`} style={{ left: tick.left }}>{tick.label}</span>
            ))}
          </div>
          <div className="timelineChart workOrderChart">
            {filteredOrders.map((order) => {
              const start = new Date(order.startDate || order.createdAt || order.dueDate);
              const end = new Date(order.dueDate || order.startDate || order.createdAt);
              const left = Math.max(0, ((start.getTime() - range.start.getTime()) / span) * 100);
              const right = Math.min(100, ((end.getTime() - range.start.getTime()) / span) * 100);
              const width = Math.max(4, right - left);

              return (
                <button
                  type="button"
                  className={`timelineBarRow dashboardClickableRow graphRow ${selectedIds.includes(String(order._id)) ? "selectedFilterItem" : ""}`}
                  key={order._id}
                  onClick={() => onWorkOrderClick?.(order)}
                >
                  <div>
                    <strong>{order.code}</strong>
                    <span>{order.items?.map((item) => `${item.quantity} x ${item.productName}`).join(", ")}</span>
                  </div>
                  <div className="timelineBarTrack">
                    <span className={`timelineBar ${order.status}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
                  </div>
                  <span>{formatDate(order.startDate)} - {formatDate(order.dueDate)}</span>
                </button>
              );
            })}
            {filteredOrders.length === 0 && <EmptyState label={label("noData")} />}
          </div>
        </div>
      )}
    </div>
  );
}
