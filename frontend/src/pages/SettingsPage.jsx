import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { api } from "../api.js";
import { CustomSelect } from "../components/CustomSelect.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { label } from "../utils/i18n.js";

const languageOptions = [
  { value: "sl", label: "Slovenscina" },
  { value: "en", label: "Anglescina" }
];

const roleOptions = [
  { value: "admin", label: "admin" },
  { value: "worker", label: "worker" }
];

const emptyUser = { id: null, name: "", email: "", password: "", role: "worker", language: "sl" };

function UserForm({ user, setUser, onSubmit, onCancel, loading, submitLabel }) {
  return (
    <form className="inlineCreatePanel" onSubmit={onSubmit}>
      <div className="sectionHeader noTopMargin">
        <h2>{user.id ? label("formEditUser") : label("formNewUser")}</h2>
        <UserPlus size={18} />
      </div>
      <label>{label("namePerson")}<input value={user.name} onChange={(event) => setUser({ ...user, name: event.target.value })} autoFocus /></label>
      <label>Email<input value={user.email} onChange={(event) => setUser({ ...user, email: event.target.value })} /></label>
      <label>{label("password")}<input type="password" placeholder={user.id ? "Pusti prazno za brez spremembe" : ""} value={user.password} onChange={(event) => setUser({ ...user, password: event.target.value })} /></label>
      <CustomSelect label={label("role")} value={user.role} options={roleOptions} onChange={(role) => setUser({ ...user, role })} />
      <CustomSelect label={label("appLanguage")} value={user.language || "sl"} options={languageOptions} onChange={(language) => setUser({ ...user, language })} />
      <div className="formActions formActionsRight">
        <button type="button" className="iconText" onClick={onCancel}>
          <X size={17} />
          {label("cancel")}
        </button>
        <button className="primary" disabled={loading}>
          {user.id ? <Save size={17} /> : <Plus size={17} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function SettingsPage({ session, dataRefreshKey }) {
  const [users, setUsers] = useState([]);
  const [language, setLanguage] = useState(() => localStorage.getItem("spw-language") || session.user?.language || "sl");
  const [timelineView, setTimelineView] = useState(() => localStorage.getItem("spw-dashboard-timeline-view") || "list");
  const [workOrdersView, setWorkOrdersView] = useState(() => localStorage.getItem("spw-dashboard-workorders-view") || "list");
  const [createForm, setCreateForm] = useState(emptyUser);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dashboardViewOptions = [
    { value: "list", label: label("list") },
    { value: "chart", label: label("graph") }
  ];

  async function loadPageData() {
    setUsers(await api.users(session.token));
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, [dataRefreshKey]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.createUser(createForm, session.token);
      setCreateForm(emptyUser);
      setShowCreateForm(false);
      await loadPageData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.updateUser(editingUser.id, editingUser, session.token);
      setEditingUser(null);
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
      await api.deleteUser(id, session.token);
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
          <h1>{label("settings")}</h1>
          <p>{label("settingsSubtitle")}</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface">
        <div className="settingsLanguage">
          <div>
            <h2>{label("appLanguage")}</h2>
            <span>{label("appLanguageHelp")}</span>
          </div>
          <CustomSelect
            value={language}
            options={languageOptions}
            onChange={(value) => {
              setLanguage(value);
              localStorage.setItem("spw-language", value);
              window.dispatchEvent(new Event("spw-language-changed"));
            }}
          />
        </div>

        <div className="settingsDashboardDefaults">
          <div>
            <h2>{label("dashboardDefaultView")}</h2>
            <span>{label("dashboardDefaultViewHelp")}</span>
          </div>
          <CustomSelect
            label={label("timelinePhases")}
            value={timelineView}
            options={dashboardViewOptions}
            onChange={(value) => {
              setTimelineView(value);
              localStorage.setItem("spw-dashboard-timeline-view", value);
            }}
          />
          <CustomSelect
            label={label("workOrders")}
            value={workOrdersView}
            options={dashboardViewOptions}
            onChange={(value) => {
              setWorkOrdersView(value);
              localStorage.setItem("spw-dashboard-workorders-view", value);
            }}
          />
        </div>

        <div className="sectionHeader">
          <h2>{label("users")}</h2>
          <div className="sectionActions">
            <span>{users.length}</span>
            <button type="button" className="primary" onClick={() => { setShowCreateForm(true); setEditingUser(null); }}>
              <Plus size={17} />
              {label("add")}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <UserForm
            user={createForm}
            setUser={setCreateForm}
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setCreateForm(emptyUser); }}
            loading={loading}
            submitLabel={label("add")}
          />
        )}

        <div className="entityList">
          {users.map((user) => {
            const userId = user._id || user.id;
            const isEditing = editingUser?.id === userId;

            return (
              <div className={`entityItem ${isEditing ? "entityEditing" : ""}`} key={userId}>
                {isEditing ? (
                  <UserForm
                    user={editingUser}
                    setUser={setEditingUser}
                    onSubmit={saveEdit}
                    onCancel={() => setEditingUser(null)}
                    loading={loading}
                    submitLabel={label("save")}
                  />
                ) : (
                  <>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email} / {user.role} / {user.language || "sl"}</span>
                    </div>
                    <div className="rowActions">
                      <button
                        className="iconButton"
                        onClick={() => {
                          setShowCreateForm(false);
                          setEditingUser({ id: userId, name: user.name, email: user.email, password: "", role: user.role, language: user.language || "sl" });
                        }}
                        aria-label="Uredi uporabnika"
                      >
                        <Pencil size={17} />
                      </button>
                      <button className="dangerButton" onClick={() => handleDelete(userId)} disabled={loading} aria-label="Izbrisi uporabnika"><Trash2 size={17} /></button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {users.length === 0 && <EmptyState label={label("noData")} />}
        </div>
      </section>
    </main>
  );
}
