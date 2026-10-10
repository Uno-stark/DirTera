import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Navigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Globe, Users, Tag, Layers,
  BarChart2, CreditCard, Home, LogOut, ShieldCheck,
  PanelLeftClose, PanelLeftOpen, Menu, X, MessageSquare, DollarSign,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/admin.css";

const navItems = [
  { to: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { to: "/admin/websites",      label: "Websites",      icon: Globe           },
  { to: "/admin/users",         label: "Users",         icon: Users           },
  { to: "/admin/reviews",       label: "Reviews",       icon: MessageSquare   },
  { to: "/admin/categories",    label: "Categories",    icon: Tag             },
  { to: "/admin/domains",       label: "Domains",       icon: Layers          },
  { to: "/admin/analytics",     label: "Analytics",     icon: BarChart2       },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard      },
  { to: "/admin/plans",         label: "Plans",         icon: DollarSign      },
];

function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  // Desktop: collapsed = icon-rail, expanded = full sidebar
  const [collapsed, setCollapsed] = useState(false);

  // Mobile: drawerOpen = sidebar slides in from left
  const [drawerOpen, setDrawerOpen] = useState(false);

  const overlayRef = useRef(null);

  // Close drawer on route change (mobile nav)
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Trap scroll behind overlay when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  if (isLoading) return null;
  if (!user || !user.is_admin) return <Navigate to="/" replace />;

  // Current page label for the mobile topbar
  const currentLabel = navItems.find((n) => location.pathname.startsWith(n.to))?.label ?? "Admin";

  return (
    <div className="admin-layout">
      {/* ── Sidebar / Drawer ── */}
      <aside
        className={[
          "admin-sidebar",
          collapsed ? "collapsed" : "",
          drawerOpen ? "drawer-open" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="admin-sidebar-inner">

          {/* Brand row */}
          <div className="admin-brand">
            <ShieldCheck size={18} color="#6366f1" strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span className="admin-brand-text">DirTera</span>

            {/* Desktop toggle (collapse ↔ expand) */}
            <button
              className="admin-sidebar-toggle desktop-only"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed
                ? <PanelLeftOpen  size={15} />
                : <PanelLeftClose size={15} />}
            </button>

            {/* Mobile close button (inside drawer) */}
            <button
              className="admin-sidebar-toggle mobile-only"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              title="Close menu"
            >
              <X size={15} />
            </button>
          </div>

          {/* Nav */}
          <nav className="admin-nav">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `admin-nav-link${isActive ? " active" : ""}`
                }
              >
                <Icon size={16} className="admin-nav-icon" />
                <span className="admin-nav-label">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="admin-sidebar-footer">
            <Link
              to="/"
              className="admin-home-link"
              title={collapsed ? "Back to site" : undefined}
            >
              <Home size={15} style={{ flexShrink: 0 }} />
              <span>Back to site</span>
            </Link>
            <button
              type="button"
              className="admin-logout"
              onClick={logout}
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut size={15} style={{ flexShrink: 0 }} />
              <span>Logout</span>
            </button>
          </div>

        </div>
      </aside>

      {/* Overlay — blocks clicks on main content when drawer is open */}
      {drawerOpen && (
        <div
          ref={overlayRef}
          className="admin-drawer-overlay visible"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main content ── */}
      <main className="admin-main">
        {/* Mobile topbar with hamburger */}
        <div className="admin-topbar">
          <button
            className="admin-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={17} />
          </button>
          <ShieldCheck size={16} color="#6366f1" strokeWidth={2.2} />
          <span className="admin-topbar-title">{currentLabel}</span>
        </div>

        <Outlet />
      </main>

      <style>{`
        /* Desktop-only / mobile-only visibility helpers */
        @media (min-width: 769px) { .mobile-only { display: none !important; } }
        @media (max-width: 768px) { .desktop-only { display: none !important; } }
      `}</style>
    </div>
  );
}

export default AdminLayout;
