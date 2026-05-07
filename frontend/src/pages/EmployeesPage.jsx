import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, CalendarDays, Clock3, ClipboardCheck, GraduationCap, PackageCheck, Plus, Save, Search, Trash2, UsersRound, Wrench, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";

const emptyEmployee = { name: "", skills: "", workingHoursPerDay: 8 };

function employeeToForm(employee) {
  return {
    id: employee._id,
    name: employee.name,
    skills: employee.skills?.join(", ") || "",
    workingHoursPerDay: employee.workingHoursPerDay
  };
}

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
  return String(phase.assignedTo || "") === String(employee._id) || phase.assignedToName === employee.name;
}

function EmployeeDetailModal({ employee, phases, onClose }) {
  if (!employee) return null;

  const { start, end } = getWeekRange();
  const employeePhases = phases.filter((phase) => isEmployeePhase(employee, phase));
  const weekPhases = employeePhases.filter((phase) => {
    const phaseStart = new Date(phase.start);
    return phaseStart >= start && phaseStart < end;
  });
  const completedThisWeek = weekPhases.filter((phase) => phase.status === "completed");
  const completedWorkOrders = new Set(completedThisWeek.map((phase) => phase.workOrderId?._id || phase.workOrderId || phase.workOrderCode || phase.name));
  const upcomingPhases = employeePhases
    .filter((phase) => phase.status !== "completed" && new Date(phase.end) >= new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 6);
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
            <span>{employee.skills?.join(", ") || "brez vnesenih znanj"} / {employee.workingHoursPerDay} h na dan</span>
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
                  <span className={`status ${phase.status}`}>{phase.status}</span>
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
      </div>
    </div>
  );
}

export function EmployeesPage({ session }) {
  const isAdmin = session.user?.role === "admin";
  const [employees, setEmployees] = useState([]);
  const [phases, setPhases] = useState([]);
  const [form, setForm] = useState(emptyEmployee);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [employeeData, phaseData] = await Promise.all([api.employees(), api.workOrderPhases()]);
    setEmployees(employeeData);
    setPhases(phaseData);
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) =>
      [employee.name, employee.skills?.join(" "), employee.workingHoursPerDay]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [employees, search]);

  async function createEmployee(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.createEmployee(
        {
          name: form.name,
          skills: form.skills,
          workingHoursPerDay: Number(form.workingHoursPerDay) || 8
        },
        session.token
      );
      setForm(emptyEmployee);
      setShowCreate(false);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEmployeeEdit() {
    setError("");
    setLoading(true);

    try {
      await api.updateEmployee(
        editingEmployee.id,
        {
          name: editingEmployee.name,
          skills: editingEmployee.skills,
          workingHoursPerDay: Number(editingEmployee.workingHoursPerDay) || 8
        },
        session.token
      );
      setEditingEmployee(null);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    setLoading(true);

    try {
      await api.deleteEmployee(id, session.token);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>Zaposleni</h1>
          <p>Ekipa, kompetence in razpolozljive ure.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface pageSection noTopMargin">
          <div className="sectionHeader">
            <h2>Ekipa</h2>
            <div className="sectionActions">
              <span>{filteredEmployees.length} / {employees.length} oseb</span>
              {isAdmin && <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                <Plus size={17} />
                Dodaj
              </button>}
            </div>
          </div>
          {isAdmin && showCreate && (
            <form className="inlineCreatePanel" onSubmit={createEmployee}>
              <div className="sectionHeader compact">
                <h2>Nov zaposleni</h2>
                <UsersRound size={18} />
              </div>
              <label>Ime<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label>
              <label>Znanja<input placeholder="rezanje, varjenje, kontrola" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label>
              <label>Ure na dan<input type="number" value={form.workingHoursPerDay} onChange={(event) => setForm({ ...form, workingHoursPerDay: event.target.value })} /></label>
              <div className="formActions formActionsRight">
                <button type="button" className="iconText" onClick={() => { setShowCreate(false); setForm(emptyEmployee); }}><X size={17} />Preklic</button>
                <button className="primary" disabled={loading}><Plus size={17} />Dodaj</button>
              </div>
            </form>
          )}
          <label className="searchField">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Isci zaposlene" />
          </label>
          <div className="entityList">
            {filteredEmployees.map((employee) => {
              const isEditing = editingEmployee?.id === employee._id;

              return (
                <div
                  className={`entityItem ${isEditing ? "entityEditing" : "productEntity"}`}
                  key={employee._id}
                  role={isEditing ? undefined : "button"}
                  tabIndex={isEditing ? undefined : 0}
                  onClick={isEditing ? undefined : () => setSelectedEmployee(employee)}
                  onKeyDown={isEditing ? undefined : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedEmployee(employee);
                    }
                  }}
                >
                  {isAdmin && isEditing ? (
                    <>
                      <div className="inlineProductForm">
                        <label>Ime<input value={editingEmployee.name} onChange={(event) => setEditingEmployee({ ...editingEmployee, name: event.target.value })} autoFocus /></label>
                        <label>Znanja<input value={editingEmployee.skills} onChange={(event) => setEditingEmployee({ ...editingEmployee, skills: event.target.value })} /></label>
                        <label>Ure na dan<input type="number" value={editingEmployee.workingHoursPerDay} onChange={(event) => setEditingEmployee({ ...editingEmployee, workingHoursPerDay: event.target.value })} /></label>
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveEmployeeEdit} disabled={loading}><Save size={17} />Shrani</button>
                        <button type="button" className="iconText" onClick={() => setEditingEmployee(null)}><X size={17} />Preklic</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{employee.name}</strong>
                        <span>{employee.skills?.join(", ") || "brez znanj"} / {employee.workingHoursPerDay}h</span>
                      </div>
                      {isAdmin && <div className="rowActions">
                        <button className="iconText" onClick={(event) => { event.stopPropagation(); setEditingEmployee(employeeToForm(employee)); }}>Uredi</button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); handleDelete(employee._id); }} disabled={loading}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredEmployees.length === 0 && <EmptyState label="Ni zadetkov" />}
          </div>
      </section>
      <EmployeeDetailModal employee={selectedEmployee} phases={phases} onClose={() => setSelectedEmployee(null)} />
    </main>
  );
}
