import { LogIn } from "lucide-react";

export function LoginStrip({ login, setLogin, loading, onLogin }) {
  return (
    <form className="loginStrip" onSubmit={onLogin}>
      <label>
        Email
        <input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
      </label>
      <label>
        Password
        <input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} />
      </label>
      <button className="primary" disabled={loading}>
        <LogIn size={17} />
        Prijava
      </button>
    </form>
  );
}
