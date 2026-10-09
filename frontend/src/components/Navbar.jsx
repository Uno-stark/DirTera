import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import { useAuth }          from "../context/AuthContext";
import { useTaxonomy }      from "../context/TaxonomyContext";
import NotificationPanel    from "./NotificationPanel";
import UserMenu             from "./UserMenu";
import logoSrc              from "../assets/logo.js";
import "../styles/navbar.css";

// ── Tiny debounce util ────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Portal dropdown — rendered in document.body so it escapes all overflow ───
function DomainPortal({ category, anchorRef }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;

    // Measure once immediately, then debounce scroll/resize to avoid
    // re-positioning on every pixel scrolled (was triggering dozens of
    // getBoundingClientRect calls per scroll event).
    const measure = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };

    const debouncedMeasure = debounce(measure, 40);

    measure(); // immediate first paint position
    window.addEventListener("scroll", debouncedMeasure, { passive: true });
    window.addEventListener("resize", debouncedMeasure, { passive: true });
    return () => {
      window.removeEventListener("scroll", debouncedMeasure);
      window.removeEventListener("resize", debouncedMeasure);
    };
  }, [anchorRef]);

  if (!rect) return null;

  return createPortal(
    <div
      className="nav-domain-portal"
      style={{ top: rect.bottom + 4, left: rect.left }}
      role="list"
      aria-label={`${category.name} domains`}
    >
      <div className="nav-domain-pills">
        {category.domains.map((domain) => (
          <Link
            key={domain.slug}
            to={`/domain/${domain.slug}`}
            className="nav-domain-pill"
            role="listitem"
          >
            {domain.name}
          </Link>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Category item ─────────────────────────────────────────────────────────────
function CategoryItem({ category }) {
  const hasDomains = category.domains?.length > 0;
  const [open, setOpen] = useState(false);
  const anchorRef  = useRef(null);
  const closeTimer = useRef(null);

  const show  = useCallback(() => { clearTimeout(closeTimer.current); setOpen(true);  }, []);
  const hide  = useCallback(() => { closeTimer.current = setTimeout(() => setOpen(false), 100); }, []);
  const close = useCallback(() => setOpen(false), []);

  // Clean up pending timer on unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <div className="nav-cat-wrapper" onMouseEnter={show} onMouseLeave={hide}>
      <Link
        ref={anchorRef}
        to={hasDomains ? `/domain/${category.domains[0].slug}` : `/domain/${category.slug}`}
        className={`nav-cat-link ${open ? "active" : ""}`}
        onClick={close}
      >
        {category.name}
      </Link>

      {hasDomains && open && (
        <DomainPortal category={category} anchorRef={anchorRef} />
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ transparent = false }) {
  const { isAuthenticated }               = useAuth();
  const { categories, isLoading }         = useTaxonomy();
  const navigate                          = useNavigate();
  const location                          = useLocation();
  const [query, setQuery]                 = useState("");
  const [notifOpen, setNotifOpen]         = useState(false);
  // A fixed anchor for the notification panel when opened from inside UserMenu
  const notifAnchorRef                    = useRef(null);

  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : "/");
  };

  const clearSearch = () => { setQuery(""); navigate("/"); };

  const openNotif  = useCallback(() => setNotifOpen(true),  []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  return (
    <header className={`site-header${transparent ? " site-header-transparent" : ""}`}>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="nav-top">
        <div className="nav-container">
          <Link to="/" className="site-logo" aria-label="DirTera home">
            {logoSrc && (
              <img src={logoSrc} alt="" className="logo-image" aria-hidden="true" />
            )}
            <span className="logo-wordmark">DirTera</span>
          </Link>

          <form className="nav-search" onSubmit={handleSearch} role="search">
            <Search size={15} className="nav-search-icon" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurants, hotels, or a city"
              aria-label="Search businesses"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="nav-search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </form>

          <nav className="main-nav" aria-label="User navigation">
            {isAuthenticated ? (
              <>
                {/* Hidden anchor for notification panel positioning */}
                <span ref={notifAnchorRef} className="notif-anchor" aria-hidden="true" />

                {/* Notification panel — driven externally by UserMenu */}
                <NotificationPanel
                  hideBell
                  externalOpen={notifOpen}
                  onExternalClose={closeNotif}
                  anchorOverride={notifAnchorRef}
                />

                {/* Circular profile + burger dropdown */}
                <UserMenu onNotifOpen={openNotif} />
              </>
            ) : (
              <button
                type="button"
                className="nav-register nav-register-btn"
                onClick={() => goModal("/login")}
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* ── Category bar ─────────────────────────────────────────────── */}
      <nav className="nav-cats-bar" aria-label="Browse by category">
        <div className="nav-container">
          <div className="nav-cats">
            {isLoading
              ? [1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="nav-cat-skeleton" aria-hidden="true" />
                ))
              : categories.map((cat) => (
                  <CategoryItem key={cat.slug} category={cat} />
                ))}
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
