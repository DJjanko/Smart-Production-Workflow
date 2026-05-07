import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, CalendarDays, Camera, Clock3, ClipboardCheck, KeyRound, Save, UserCircle } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";

const emptyPassword = { currentPassword: "", newPassword: "" };

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

export function AccountPage({ session }) {
  const [account, setAccount] = useState(session.user);
  const [employees, setEmployees] = useState([]);
  const [phases, setPhases] = useState([]);
  const [passwordForm, setPasswordForm] = useState(emptyPassword);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    const [me, employeeData, phaseData] = await Promise.all([
      api.me(session.token),
      api.employees(),
      api.workOrderPhases()
    ]);
    setAccount(me);
    setEmployees(employeeData);
    setPhases(phaseData);
    localStorage.setItem("spw-session", JSON.stringify({ ...session, user: me }));
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

  const employee = useMemo(() => (
    employees.find((item) => String(item.userId || "") === String(account.id)) ||
    employees.find((item) => item.name?.toLowerCase() === account.name?.toLowerCase())
  ), [employees, account]);

  const employeeStats = useMemo(() => {
    const { start, end } = getWeekRange();
    const employeePhases = employee
      ? phases.filter((phase) => String(phase.assignedTo || "") === String(employee._id) || phase.assignedToName === employee.name)
      : [];
    const weekPhases = employeePhases.filter((phase) => {
      const phaseStart = new Date(phase.start);
      return phaseStart >= start && phaseStart < end;
    });
    const completedWorkOrders = new Set(
      weekPhases
        .filter((phase) => phase.status === "completed")
        .map((phase) => phase.workOrderId?._id || phase.workOrderId || phase._id)
    );
    const plannedHours = weekPhases.reduce((sum, phase) => sum + phaseDurationHours(phase), 0);
    const regularHours = Number(employee?.workingHoursPerDay || 8) * 5;

    return {
      completedWorkOrders: completedWorkOrders.size,
      plannedHours,
      overtime: Math.max(0, plannedHours - regularHours),
      upcoming: employeePhases.filter((phase) => phase.status !== "completed" && new Date(phase.end) >= new Date()).slice(0, 5)
    };
  }, [employee, phases]);

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.updateMe(passwordForm, session.token);
      setPasswordForm(emptyPassword);
      setMessage("Geslo je posodobljeno.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function changeAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setLoading(true);
      setError("");
      try {
        const updated = await api.updateMe({ avatarUrl: reader.result }, session.token);
        setAccount(updated);
        localStorage.setItem("spw-session", JSON.stringify({ ...session, user: updated }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <h1>My account</h1>
          <p>Prijavljeni uporabnik, statistika in osebne nastavitve.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}
      {message && <div className="alert successAlert"><Save size={18} />{message}</div>}

      <section className="accountGrid">
        <div className="surface accountProfile">
          <label className="accountAvatar editableAvatar">
            {account.avatarUrl ? <img src={account.avatarUrl} alt="" /> : <UserCircle size={42} />}
            <input type="file" accept="image/*" onChange={changeAvatar} />
            <span><Camera size={15} /> Slika</span>
          </label>
          <div>
            <h2>{account.name}</h2>
            <p>{account.email}</p>
            <span className="status">{account.role}</span>
          </div>
        </div>

        <form className="surface formPanel" onSubmit={changePassword}>
          <div className="sectionHeader">
            <h2>Spremeni geslo</h2>
            <KeyRound size={18} />
          </div>
          <label>Trenutno geslo<input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label>
          <label>Novo geslo<input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label>
          <div className="formActions formActionsRight">
            <button className="primary" disabled={loading}><Save size={17} />Shrani geslo</button>
          </div>
        </form>

        <div className="surface accountStats">
          <div className="sectionHeader">
            <h2>Moja statistika</h2>
            <span>ta teden</span>
          </div>
          <div className="employeeStatsGrid">
            <div className="employeeStat"><ClipboardCheck size={18} /><span>Nalogi</span><strong>{employeeStats.completedWorkOrders}</strong></div>
            <div className="employeeStat"><Clock3 size={18} /><span>Ure</span><strong>{employeeStats.plannedHours.toFixed(1)} h</strong></div>
            <div className="employeeStat"><Briefcase size={18} /><span>Nadure</span><strong>{employeeStats.overtime.toFixed(1)} h</strong></div>
            <div className="employeeStat"><CalendarDays size={18} /><span>Zaposlen od</span><strong>{account.createdAt ? new Date(account.createdAt).toLocaleDateString("sl-SI") : "-"}</strong></div>
          </div>
          <div className="futureTaskList accountFutureTasks">
            {employeeStats.upcoming.map((phase) => (
              <div className="futureTask" key={phase._id}>
                <div>
                  <strong>{phase.name}</strong>
                  <span>{phase.workOrderId?.code || "Delovni nalog"} / {phase.requiredSkill}</span>
                </div>
                <span className={`status ${phase.status}`}>{phase.status}</span>
              </div>
            ))}
            {employeeStats.upcoming.length === 0 && <EmptyState label="Ni planiranih nalog" />}
          </div>
        </div>
      </section>
    </main>
  );
}
