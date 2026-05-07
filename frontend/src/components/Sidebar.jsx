import {
  Boxes,
  ClipboardList,
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

const navItems = [
  { key: "dashboard", label: "Pregled", icon: LayoutDashboard },
  { key: "products", label: "Izdelki", icon: Boxes },
  { key: "inventory", label: "Zaloga", icon: PackageCheck },
  { key: "employees", label: "Zaposleni", icon: UsersRound },
  { key: "orders", label: "Narocila", icon: ClipboardList },
  { key: "workOrders", label: "Delovni nalogi", icon: Hammer },
  { key: "comparison", label: "Primerjava", icon: Gauge },
  { key: "settings", label: "Nastavitve", icon: Settings, adminOnly: true }
];

export function Sidebar({ activePage, onNavigate, onLogout, session }) {
  const isAdmin = session?.user?.role === "admin";

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
          {navItems.filter((item) => !item.adminOnly || isAdmin).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`navItem ${activePage === key ? "active" : ""}`}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebarBottom">
        <button
          className={`navItem accountButton ${activePage === "account" ? "active" : ""}`}
          onClick={() => onNavigate("account")}
        >
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
