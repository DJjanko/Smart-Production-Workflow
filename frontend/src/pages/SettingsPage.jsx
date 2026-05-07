import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { api } from "../api.js";
import { EmptyState } from "../components/EmptyState.jsx";

const emptyUser = { id: null, name: "", email: "", password: "", role: "worker", language: "sl" };

function UserForm({ user, setUser, onSubmit, onCancel, loading, submitLabel }) {
  return (
    <form className="inlineCreatePanel" onSubmit={onSubmit}>
      <div className="sectionHeader noTopMargin">
        <h2>{submitLabel === "Dodaj" ? "Nov uporabnik" : "Uredi uporabnika"}</h2>
        <UserPlus size={18} />
      </div>
      <label>Ime<input value={user.name} onChange={(event) => setUser({ ...user, name: event.target.value })} autoFocus /></label>
      <label>Email<input value={user.email} onChange={(event) => setUser({ ...user, email: event.target.value })} /></label>
      <label>Geslo<input type="password" placeholder={user.id ? "Pusti prazno za brez spremembe" : ""} value={user.password} onChange={(event) => setUser({ ...user, password: event.target.value })} /></label>
      <label>
        Vloga
        <select value={user.role} onChange={(event) => setUser({ ...user, role: event.target.value })}>
          <option value="admin">admin</option>
          <option value="worker">worker</option>
        </select>
      </label>
      <label>
        Jezik
        <select value={user.language || "sl"} onChange={(event) => setUser({ ...user, language: event.target.value })}>
          <option value="sl">Slovenscina</option>
          <option value="en">Anglescina</option>
        </select>
      </label>
      <div className="formActions formActionsRight">
        <button type="button" className="iconText" onClick={onCancel}>
          <X size={17} />
          Preklic
        </button>
        <button className="primary" disabled={loading}>
          {submitLabel === "Dodaj" ? <Plus size={17} /> : <Save size={17} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function SettingsPage({ session }) {
  const [users, setUsers] = useState([]);
  const [language, setLanguage] = useState(() => localStorage.getItem("spw-language") || session.user?.language || "sl");
  const [createForm, setCreateForm] = useState(emptyUser);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPageData() {
    setUsers(await api.users(session.token));
  }

  useEffect(() => {
    loadPageData().catch((err) => setError(err.message));
  }, []);

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
          <h1>Nastavitve</h1>
          <p>Uporabniki in osnovne pravice dostopa.</p>
        </div>
      </header>

      {error && <div className="alert"><AlertTriangle size={18} />{error}</div>}

      <section className="surface">
        <div className="settingsLanguage">
          <div>
            <h2>Jezik aplikacije</h2>
            <span>Izbira jezika vmesnika za uporabnika.</span>
          </div>
          <select value={language} onChange={(event) => { setLanguage(event.target.value); localStorage.setItem("spw-language", event.target.value); }}>
            <option value="sl">Slovenscina</option>
            <option value="en">Anglescina</option>
          </select>
        </div>

        <div className="sectionHeader">
          <h2>Uporabniki</h2>
          <div className="sectionActions">
            <span>{users.length}</span>
            <button type="button" className="primary" onClick={() => { setShowCreateForm(true); setEditingUser(null); }}>
              <Plus size={17} />
              Dodaj
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
            submitLabel="Dodaj"
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
                    submitLabel="Shrani"
                  />
                ) : (
                  <>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email} / {user.role} / {user.language || "sl"}</span>
                    </div>
                    <div className="rowActions">
                      <button
                        className="iconText"
                        onClick={() => {
                          setShowCreateForm(false);
                          setEditingUser({ id: userId, name: user.name, email: user.email, password: "", role: user.role, language: user.language || "sl" });
                        }}
                      >
                        Uredi
                      </button>
                      <button className="dangerButton" onClick={() => handleDelete(userId)} disabled={loading} aria-label="Izbrisi uporabnika"><Trash2 size={17} /></button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {users.length === 0 && <EmptyState label="Ni uporabnikov" />}
        </div>
      </section>
    </main>
  );
}
