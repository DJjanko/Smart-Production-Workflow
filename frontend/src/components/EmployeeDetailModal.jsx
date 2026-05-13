import { Briefcase, CalendarDays, Clock3, ClipboardCheck, GraduationCap, PackageCheck, Wrench, X } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { TimelinePanel } from "./TimelinePanel.jsx";
import { formatDate } from "../utils/date.js";
import { label } from "../utils/i18n.js";

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function phaseDurationHours(phase) {
  const start = new Date(phase.start);
  const end = new Date(phase.end);
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

function isEmployeePhase(employee, phase) {
  return String(phase.assignedTo || "") === String(employee._id || employee.id) || phase.assignedToName === employee.name;
}

export function EmployeeDetailModal({ employee, phases, onClose }) {
  if (!employee) return null;

  const { start, end } = getWeekRange();
  const now = new Date();
  const employeePhases = phases
    .filter((phase) => isEmployeePhase(employee, phase))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const weekPhases = employeePhases.filter((phase) => {
    const phaseStart = new Date(phase.start);
    return phaseStart >= start && phaseStart < end;
  });
  const completedThisWeek = weekPhases.filter((phase) => phase.status === "completed");
  const completedWorkOrders = new Set(completedThisWeek.map((phase) => phase.workOrderId?._id || phase.workOrderId || phase.workOrderCode || phase.name));
  const upcomingPhases = employeePhases
    .filter((phase) => phase.status !== "completed" && new Date(phase.end) >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 6);
  const currentPhase = employeePhases.find((phase) => phase.status === "in_progress")
    || employeePhases.find((phase) => new Date(phase.start) <= now && new Date(phase.end) >= now)
    || upcomingPhases[0];
  const plannedHoursThisWeek = weekPhases.reduce((sum, phase) => sum + phaseDurationHours(phase), 0);
  const regularHours = Number(employee.workingHoursPerDay || 8) * 5;
  const overtime = Math.max(0, plannedHoursThisWeek - regularHours);
  const hiredSince = employee.createdAt ? new Date(employee.createdAt).toLocaleDateString("sl-SI") : "Ni vneseno";

  const stats = [
    { label: "Nalogi ta teden", value: completedWorkOrders.size, icon: ClipboardCheck },
    { label: "Ure ta teden", value: `${plannedHoursThisWeek.toFixed(1)} h`, icon: Clock3 },
    { label: "Nadure", value: `${overtime.toFixed(1)} h`, icon: Briefcase },
    { label: "Od", value: hiredSince, icon: CalendarDays }
  ];

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="employeeDetailTitle" onClick={onClose}>
      <div className="productModal employeeModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <div>
            <h2 id="employeeDetailTitle">{employee.name}</h2>
            <span>{employee.skills?.join(", ") || "brez vnesenih znanj"} / {employee.workingHoursPerDay || 8} h na dan</span>
          </div>
          <button type="button" className="iconButton" onClick={onClose} aria-label="Zapri podrobnosti zaposlenega">
            <X size={18} />
          </button>
        </div>

        <section className="employeeStatsGrid">
          {stats.map(({ label, value, icon: Icon }) => (
            <div className="employeeStat" key={label}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="currentWorkPanel">
          <div>
            <span>{label("status")}</span>
            <strong>{currentPhase ? "Dodeljen na fazo" : "Trenutno prost"}</strong>
            <p>
              {currentPhase
                ? `${currentPhase.workOrderId?.code || "Delovni nalog"} / ${currentPhase.name} / ${formatDate(currentPhase.start)} - ${formatDate(currentPhase.end)}`
                : label("noPhases")}
            </p>
          </div>
          {currentPhase && <StatusBadge value={currentPhase.status} />}
        </section>

        <section className="employeeDetailLayout">
          <div className="detailSection">
            <div className="sectionHeader compact">
              <h3>Kaj ima se za naredit</h3>
              <span>{upcomingPhases.length}</span>
            </div>
            <div className="futureTaskList">
              {upcomingPhases.map((phase) => (
                <div className="futureTask" key={phase._id}>
                  <div>
                    <strong>{phase.name}</strong>
                    <span>{phase.workOrderId?.code || "Delovni nalog"} / {phase.requiredSkill}</span>
                  </div>
                  <StatusBadge value={phase.status} />
                </div>
              ))}
              {upcomingPhases.length === 0 && <EmptyState label="Ni planiranih faz" />}
            </div>
          </div>

          <div className="detailSection">
            <div className="sectionHeader compact">
              <h3>Profil in koledar</h3>
              <span>HR</span>
            </div>
            <div className="employeeInfoGrid">
              <div className="detailCard">
                <GraduationCap size={18} />
                <strong>Trenutna znanja</strong>
                <span>{employee.skills?.join(", ") || "Ni vneseno"}</span>
              </div>
              <div className="detailCard">
                <Wrench size={18} />
                <strong>Kaj se uci</strong>
                <span>Ni vneseno</span>
              </div>
              <div className="detailCard">
                <PackageCheck size={18} />
                <strong>Delovna oprema</strong>
                <span>Ni vneseno</span>
              </div>
              <div className="detailCard">
                <Briefcase size={18} />
                <strong>Urna postavka</strong>
                <span>Ni vneseno</span>
              </div>
              <div className="detailCard">
                <Clock3 size={18} />
                <strong>Ure in nadure</strong>
                <span>{plannedHoursThisWeek.toFixed(1)} h ta teden / {overtime.toFixed(1)} h nadur</span>
              </div>
              <div className="detailCard">
                <CalendarDays size={18} />
                <strong>Planiran dopust</strong>
                <span>Ni vneseno v delovni koledar</span>
              </div>
            </div>
          </div>
        </section>

        <section className="employeeTimelineFull">
          <TimelinePanel
            timeline={employeePhases}
            contextFilters={[{ type: "employee", id: employee._id || employee.id, name: employee.name, label: employee.name }]}
            showClear={false}
          />
        </section>
      </div>
    </div>
  );
}
