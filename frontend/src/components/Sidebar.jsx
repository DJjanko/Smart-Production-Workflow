import {
  Boxes,
  CalendarDays,
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
import { label } from "../utils/i18n.js";

const navItems = [
  { key: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { key: "timeline", labelKey: "timeline", icon: CalendarDays },
  { key: "products", labelKey: "products", icon: Boxes },
  { key: "inventory", labelKey: "inventory", icon: PackageCheck },
  { key: "employees", labelKey: "employees", icon: UsersRound },
  { key: "orders", labelKey: "orders", icon: ClipboardList, adminOnly: true },
  { key: "workOrders", labelKey: "workOrders", icon: Hammer },
  { key: "comparison", labelKey: "comparison", icon: Gauge, adminOnly: true },
  { key: "settings", labelKey: "settings", icon: Settings, adminOnly: true }
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
          {navItems.filter((item) => !item.adminOnly || isAdmin).map(({ key, labelKey, icon: Icon }) => (
            <button
              key={key}
              className={`navItem ${activePage === key ? "active" : ""}`}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              {label(labelKey)}
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
          {label("account")}
        </button>
        <button className="navItem logoutButton" onClick={onLogout}>
          <LogOut size={18} />
          {label("logout")}
        </button>
      </div>
    </aside>
  );
}
