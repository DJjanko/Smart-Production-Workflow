import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Save, Search, Trash2, UsersRound, X } from "lucide-react";
import { api } from "../api.js";
import { EmployeeDetailModal } from "../components/EmployeeDetailModal.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { label } from "../utils/i18n.js";

const emptyEmployee = { name: "", skills: "", workingHoursPerDay: 8 };

function employeeToForm(employee) {
  return {
    id: employee._id,
    name: employee.name,
    skills: employee.skills?.join(", ") || "",
    workingHoursPerDay: employee.workingHoursPerDay
  };
}

export function EmployeesPage({ session, dataRefreshKey }) {
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
  }, [dataRefreshKey]);

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
          <h1>{label("employees")}</h1>
          <p>{label("employeesSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface pageSection noTopMargin">
          <div className="sectionHeader">
            <h2>{label("team")}</h2>
            <div className="sectionActions">
              <span>{filteredEmployees.length} / {employees.length} oseb</span>
              {isAdmin && <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                <Plus size={17} />
                {label("add")}
              </button>}
            </div>
          </div>
          {isAdmin && showCreate && (
            <form className="inlineCreatePanel" onSubmit={createEmployee}>
              <div className="sectionHeader compact">
                <h2>{label("formNewEmployee")}</h2>
                <UsersRound size={18} />
              </div>
              <label>{label("namePerson")}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label>
              <label>{label("skills")}<input placeholder="rezanje, varjenje, kontrola" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label>
              <label>{label("workingHoursDay")}<input type="number" value={form.workingHoursPerDay} onChange={(event) => setForm({ ...form, workingHoursPerDay: event.target.value })} /></label>
              <div className="formActions formActionsRight">
                <button type="button" className="iconText" onClick={() => { setShowCreate(false); setForm(emptyEmployee); }}><X size={17} />{label("cancel")}</button>
                <button className="primary" disabled={loading}><Plus size={17} />{label("add")}</button>
              </div>
            </form>
          )}
          <label className="searchField">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={label("searchEmployees")} />
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
                        <label>{label("namePerson")}<input value={editingEmployee.name} onChange={(event) => setEditingEmployee({ ...editingEmployee, name: event.target.value })} autoFocus /></label>
                        <label>{label("skills")}<input value={editingEmployee.skills} onChange={(event) => setEditingEmployee({ ...editingEmployee, skills: event.target.value })} /></label>
                        <label>{label("workingHoursDay")}<input type="number" value={editingEmployee.workingHoursPerDay} onChange={(event) => setEditingEmployee({ ...editingEmployee, workingHoursPerDay: event.target.value })} /></label>
                      </div>
                      <div className="rowActions inlineProductActions">
                        <button type="button" className="primary" onClick={saveEmployeeEdit} disabled={loading}><Save size={17} />{label("save")}</button>
                        <button type="button" className="iconText" onClick={() => setEditingEmployee(null)}><X size={17} />{label("cancel")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <strong>{employee.name}</strong>
                        <span>{employee.skills?.join(", ") || "brez znanj"} / {employee.workingHoursPerDay}h</span>
                      </div>
                      {isAdmin && <div className="rowActions">
                        <button className="iconButton" onClick={(event) => { event.stopPropagation(); setEditingEmployee(employeeToForm(employee)); }} aria-label="Uredi zaposlenega"><Pencil size={17} /></button>
                        <button className="dangerButton" onClick={(event) => { event.stopPropagation(); handleDelete(employee._id); }} disabled={loading}><Trash2 size={17} /></button>
                      </div>}
                    </>
                  )}
                </div>
              );
            })}
            {filteredEmployees.length === 0 && <EmptyState label={label("noResults")} />}
          </div>
      </section>
      <EmployeeDetailModal employee={selectedEmployee} phases={phases} onClose={() => setSelectedEmployee(null)} />
    </main>
  );
}
