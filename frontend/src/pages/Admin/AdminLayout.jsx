import { NavLink, Outlet, Navigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/admin.css";

const navItems = [
  { to: "/admin/dashboard",     label: "Dashboard"     },
  { to: "/admin/websites",      label: "Websites"      },
  { to: "/admin/users",         label: "Users"         },
  { to: "/admin/categories",    label: "Categories"    },
  { to: "/admin/domains",       label: "Domains"       },
  { to: "/admin/analytics",     label: "Analytics"     },
  { to: "/admin/subscriptions", label: "Subscriptions" },
];

function AdminLayout() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <p>Loading...</p>;

  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">DirTera Admin</div>

        <nav className="admin-nav">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-home-link">← Back to home</Link>
          <button type="button" className="admin-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
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
      </main>
    </div>
  );
}

export default AdminLayout;
