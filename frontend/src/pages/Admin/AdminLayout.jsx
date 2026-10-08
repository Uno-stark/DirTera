import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate, Link } from "react-router-dom";
import { Bell, ChevronDown, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";
import "../../styles/admin.css";

const navItems = [
  { to: "/admin/dashboard",     label: "Dashboard"     },
  { to: "/admin/requests",      label: "Requests"      },
  { to: "/admin/categories",    label: "Categories"    },
  { to: "/admin/domains",       label: "Domains"       },
  { to: "/admin/websites",      label: "Websites"      },
  { to: "/admin/users",         label: "Users"         },
  { to: "/admin/analytics",     label: "Analytics"     },
  { to: "/admin/subscriptions", label: "Subscriptions" },
];

function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.get("/api/v1/notifications", { params: { unread_only: true, page: 1, page_size: 1 } })
      .then(({ data }) => setUnreadCount(data.total ?? 0))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) return <p style={{ padding: 40 }}>Loading...</p>;
  if (!user || !user.is_admin) return <Navigate to="/" replace />;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarW = sidebarOpen ? 220 : 0;

  return (
    <div className="admin-layout">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar" style={{ width: sidebarW, minWidth: sidebarW }}>
        <div className="admin-brand">DirTera Admin</div>
        <nav className="admin-nav">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-home-link">← Back to home</Link>
          <button type="button" className="admin-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main" style={{ marginLeft: sidebarW }}>
        {/* Top navbar */}
        <nav className="admin-topnav" style={{ left: sidebarW }}>
          <button className="admin-topnav-menu-btn" onClick={() => setSidebarOpen((o) => !o)} title="Toggle sidebar">
            <span className="admin-hamburger">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
          <span className="admin-topnav-brand">DirTera Admin</span>

          <div className="admin-topnav-actions">
            <button className="admin-notif-btn" title="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="admin-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </button>

            <div className="admin-profile-wrap" ref={profileRef}>
              <button className="admin-profile-btn" onClick={() => setProfileOpen((o) => !o)}>
                <div className="admin-profile-avatar">
                  <User size={14} />
                </div>
                <span className="admin-profile-name">{user.full_name || user.email}</span>
                <ChevronDown size={14} style={{ color: "#6b7280", transition: "transform 0.2s", transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {profileOpen && (
                <div className="admin-profile-dropdown">
                  <div className="admin-profile-dropdown-header">
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{user.full_name || "Admin"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{user.email}</div>
                  </div>
                  <div className="admin-profile-dropdown-divider" />
                  <button onClick={() => { setProfileOpen(false); navigate("/admin/profile"); }} className="admin-profile-dropdown-item">Profile</button>
                  <button onClick={() => { setProfileOpen(false); navigate("/admin/settings"); }} className="admin-profile-dropdown-item">Settings</button>
                  <div className="admin-profile-dropdown-divider" />
                  <button onClick={handleLogout} className="admin-profile-dropdown-item" style={{ color: "#dc2626" }}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Scrollable content */}
        <div className="admin-content">
          <Outlet />
          <footer className="admin-footer">
            <div className="admin-footer-inner">
              <div className="admin-footer-brand">
                <span className="admin-footer-logo">DirTera</span>
                <span className="admin-footer-tagline">Admin Console</span>
              </div>
              <div className="admin-footer-links">
                <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
                <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
                <a href="mailto:support@dirterra.com">Support</a>
                <a href="/docs" target="_blank" rel="noreferrer">Documentation</a>
              </div>
              <div className="admin-footer-copy">
                © {new Date().getFullYear()} DirTera. All rights reserved. &nbsp;·&nbsp; v1.0.0
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
