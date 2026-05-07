import {
  Boxes,
  Gauge,
  Hammer,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Settings,
  UserCircle,
  UsersRound
} from "lucide-react";
import logo from "../images/logo.png";

export function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <img src={logo} alt="" />
          <div>
            <strong>WorkOrder AI</strong>
            <span>Production workflow</span>
          </div>
        </div>

        <nav className="navList" aria-label="Main">
          <button className="navItem active"><LayoutDashboard size={18} />Pregled</button>
          <button className="navItem"><Boxes size={18} />Izdelki</button>
          <button className="navItem"><PackageCheck size={18} />Zaloga</button>
          <button className="navItem"><UsersRound size={18} />Zaposleni</button>
          <button className="navItem"><Hammer size={18} />Delovni nalogi</button>
          <button className="navItem"><Gauge size={18} />Primerjava</button>
          <button className="navItem"><Settings size={18} />Nastavitve</button>
        </nav>
      </div>

      <div className="sidebarBottom">
        <button className="navItem accountButton">
          <UserCircle size={18} />
          My account
        </button>
        <button className="navItem logoutButton" onClick={onLogout}>
          <LogOut size={18} />
          Odjava
        </button>
      </div>
    </aside>
  );
}
