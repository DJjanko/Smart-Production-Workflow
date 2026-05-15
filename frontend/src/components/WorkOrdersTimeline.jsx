import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { StatusFilterMenu } from "./StatusFilterMenu.jsx";
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

function monthRange(value) {
  const [year, month] = (value || currentMonthInput()).split("-").map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function periodRange(mode, monthValue, yearValue) {
  if (mode === "year") {
    const year = Number(yearValue) || new Date().getFullYear();
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }
  return monthRange(monthValue);
}

function shiftMonth(value, direction) {
  const [year, month] = (value || currentMonthInput()).split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 7);
}

function shiftPeriod(mode, monthValue, yearValue, direction) {
  if (mode === "year") {
    return { month: monthValue, year: String((Number(yearValue) || new Date().getFullYear()) + direction) };
  }
  return { month: shiftMonth(monthValue, direction), year: yearValue };
}

function orderOverlapsPeriod(order, range) {
  const start = new Date(order.startDate || order.createdAt || order.dueDate);
  const end = new Date(order.dueDate || order.startDate || order.createdAt);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start < range.end && end > range.start;
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

export function WorkOrdersTimeline({ workOrders, onWorkOrderClick }) {
  const [periodMode, setPeriodMode] = useState("month");
  const [month, setMonth] = useState(currentMonthInput());
  const [year, setYear] = useState(currentYearInput());
  const [statusFilter, setStatusFilter] = useState("all");
  const range = useMemo(() => periodRange(periodMode, month, year), [periodMode, month, year]);
  const ticks = useMemo(() => periodTicks(periodMode, range), [periodMode, range]);
  const filteredOrders = useMemo(
    () => workOrders.filter((order) =>
      orderOverlapsPeriod(order, range) &&
      (statusFilter === "all" || order.status === statusFilter)
    ),
    [workOrders, range, statusFilter]
  );
  const span = Math.max(1, range.end.getTime() - range.start.getTime());

  function movePeriod(direction) {
    const next = shiftPeriod(periodMode, month, year, direction);
    setMonth(next.month);
    setYear(next.year);
  }

  return (
    <section className="surface pageSection workOrdersTimeline">
      <div className="sectionHeader">
        <h2>Casovnica nalogov</h2>
        <div className="timelineHeaderActions">
          <span>{filteredOrders.length} / {workOrders.length}</span>
          <StatusFilterMenu value={statusFilter} onChange={setStatusFilter} ariaLabel="Filter statusa" />
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
        </div>
      </div>

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
                className={`timelineBarRow dashboardClickableRow graphRow status-${order.status}`}
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
          {filteredOrders.length === 0 && <EmptyState label="Ni nalogov v izbranem obdobju" />}
        </div>
      </div>
    </section>
  );
}
