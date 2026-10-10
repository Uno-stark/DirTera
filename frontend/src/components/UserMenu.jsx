import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  ShieldCheck,
  Download,
  CreditCard,
  LogOut,
  ChevronRight,
  Loader,
} from "lucide-react";

import { useAuth }        from "../context/AuthContext";
import { useNotifCount }  from "./NotificationPanel";
import { ExportPopup, SubscriptionsPopup, SubscribePopup } from "./UserPopups";
import LogoutToast        from "./LogoutToast";

// ── Avatar initials helper ────────────────────────────────────────────────────
function getInitials(user) {
  if (user?.full_name) {
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (user?.email) return user.email[0].toUpperCase();
  return "?";
}

function Avatar({ user, size }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = user?.avatar_url && !imgFailed;

  return (
    <span className={`umenu-avatar umenu-avatar--${size}`}>
      {showImg
        ? (
          <img
            src={user.avatar_url}
            alt=""
            className="umenu-avatar-img"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )
        : <span className="umenu-avatar-initials">{getInitials(user)}</span>
      }
    </span>
  );
}

// ── Dropdown portal ───────────────────────────────────────────────────────────
function MenuDropdown({
  anchorRef, onClose, user, unreadCount,
  onNotifClick, onExport, onSubscriptions, onSubscribe, onLogout, isLoggingOut,
}) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const place = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!pos) return null;

  const displayName = user?.full_name || user?.email || "Account";

  // Helper: close menu, then open popup
  const pick = (fn) => () => { onClose(); fn(); };

  return createPortal(
    <div
      ref={panelRef}
      className="umenu-panel"
      style={{ top: pos.top, right: pos.right }}
      role="menu"
      aria-label="User menu"
    >
      {/* ── Profile header ──────────────────────────────────────── */}
      <div className="umenu-profile-header">
        <Avatar user={user} size="md" />
        <div className="umenu-profile-info">
          <span className="umenu-profile-name">{displayName}</span>
          {user?.email && user?.full_name && (
            <span className="umenu-profile-email">{user.email}</span>
          )}
        </div>
      </div>

      <div className="umenu-divider" />

      <nav className="umenu-list" role="none">

        {/* Notifications */}
        <button type="button" className="umenu-item" role="menuitem"
          onClick={pick(onNotifClick)}>
          <Bell size={15} className="umenu-item-icon" />
          <span className="umenu-item-label">Notifications</span>
          {unreadCount > 0 && (
            <span className="umenu-item-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
          <ChevronRight size={13} className="umenu-item-chevron" />
        </button>

        {/* Dashboard */}
        <Link to="/dashboard" className="umenu-item" role="menuitem" onClick={onClose}>
          <LayoutDashboard size={15} className="umenu-item-icon" />
          <span className="umenu-item-label">Dashboard</span>
          <ChevronRight size={13} className="umenu-item-chevron" />
        </Link>

        {/* Admin */}
        {user?.is_admin && (
          <Link to="/admin/dashboard" className="umenu-item umenu-item--admin"
            role="menuitem" onClick={onClose}>
            <ShieldCheck size={15} className="umenu-item-icon" />
            <span className="umenu-item-label">Admin Panel</span>
            <ChevronRight size={13} className="umenu-item-chevron" />
          </Link>
        )}

        <div className="umenu-divider" />

        {/* Export — opens popup */}
        <button type="button" className="umenu-item" role="menuitem"
          onClick={pick(onExport)}>
          <Download size={15} className="umenu-item-icon" />
          <span className="umenu-item-label">Export Analytics</span>
          <ChevronRight size={13} className="umenu-item-chevron" />
        </button>

        {/* My Subscription — opens popup */}
        <button type="button" className="umenu-item" role="menuitem"
          onClick={pick(onSubscriptions)}>
          <CreditCard size={15} className="umenu-item-icon" />
          <span className="umenu-item-label">My Subscription</span>
          <ChevronRight size={13} className="umenu-item-chevron" />
        </button>

        {/* Subscribe — opens popup */}
        <button type="button" className="umenu-item umenu-item--subscribe" role="menuitem"
          onClick={pick(onSubscribe)}>
          <CreditCard size={15} className="umenu-item-icon" />
          <span className="umenu-item-label">Subscribe</span>
          <ChevronRight size={13} className="umenu-item-chevron" />
        </button>

        <div className="umenu-divider" />

        {/* Sign out */}
        <button type="button" className="umenu-item umenu-item--danger" role="menuitem"
          onClick={() => { onLogout(); onClose(); }}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          {isLoggingOut
            ? <Loader size={15} className="umenu-item-icon umenu-spin" />
            : <LogOut  size={15} className="umenu-item-icon" />
          }
          <span className="umenu-item-label">
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </span>
        </button>
      </nav>
    </div>,
    document.body
  );
}

// ── Main UserMenu ─────────────────────────────────────────────────────────────
function UserMenu({ onNotifOpen }) {
  const { user, logout, logoutState, clearLogoutState } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [popup,    setPopup]    = useState(null); // "export"|"subscriptions"|"subscribe"|null
  const triggerRef  = useRef(null);
  const unreadCount = useNotifCount();

  const closeMenu  = useCallback(() => setMenuOpen(false), []);
  const closePopup = useCallback(() => setPopup(null),     []);

  const isLoggingOut = logoutState === "pending";

  // Close the menu as soon as logout starts (don't wait for the network)
  const handleLogout = useCallback(() => {
    closeMenu();
    logout();
  }, [closeMenu, logout]);

  return (
    <>
      {/* ── Trigger ──────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        className="umenu-trigger"
        onClick={() => !isLoggingOut && setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`${user?.full_name || user?.email || "User"} menu`}
        disabled={isLoggingOut}
      >
        <Avatar user={user} size="sm" />

        <span className="umenu-trigger-name">
          {isLoggingOut
            ? "Signing out…"
            : user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Account"
          }
        </span>

        {!isLoggingOut && unreadCount > 0 && (
          <span className="umenu-trigger-badge" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {isLoggingOut
          ? <Loader size={14} className="umenu-burger umenu-spin" aria-hidden="true" />
          : (
            <span className={`umenu-burger${menuOpen ? " umenu-burger--open" : ""}`} aria-hidden="true">
              <span /><span /><span />
            </span>
          )
        }
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────── */}
      {menuOpen && (
        <MenuDropdown
          anchorRef={triggerRef}
          onClose={closeMenu}
          user={user}
          unreadCount={unreadCount}
          onNotifClick={onNotifOpen}
          onExport={()        => setPopup("export")}
          onSubscriptions={() => setPopup("subscriptions")}
          onSubscribe={()     => setPopup("subscribe")}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      )}

      {/* ── Popups ───────────────────────────────────────────────── */}
      {popup === "export"        && <ExportPopup        onClose={closePopup} />}
      {popup === "subscriptions" && <SubscriptionsPopup onClose={closePopup} />}
      {popup === "subscribe"     && <SubscribePopup     onClose={closePopup} />}

      {/* ── Logout toast ─────────────────────────────────────────── */}
      <LogoutToast state={logoutState} onDone={clearLogoutState} />
    </>
  );
}

export default UserMenu;
