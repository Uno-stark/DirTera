import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X, Menu, ChevronDown } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  // A fixed anchor for the notification panel when opened from inside UserMenu
  const notifAnchorRef                    = useRef(null);

  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : "/");
    setMobileMenuOpen(false);
  };

  const clearSearch = () => { setQuery(""); navigate("/"); };

  const openNotif  = useCallback(() => setNotifOpen(true),  []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setExpandedCategory(null);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const toggleCategory = (slug, hasDomains) => {
    if (!hasDomains) return;
    setExpandedCategory(expandedCategory === slug ? null : slug);
  };

  return (
    <header className={`site-header${transparent ? " site-header-transparent" : ""}`}>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="nav-top">
        <div className="nav-container">
          <Link to="/" className="site-logo" aria-label="DirTera home">
            {logoSrc && (
              <img src={logoSrc} alt="" className="logo-image" aria-hidden="true" loading="eager" />
            )}
            <span className="logo-wordmark">DirTera</span>
          </Link>

          {/* Desktop search - hidden on mobile */}
          <form className="nav-search nav-search-desktop" onSubmit={handleSearch} role="search">
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
            {/* Mobile hamburger menu button */}
            <button
              className="nav-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu size={20} />
            </button>

            {/* Desktop nav items */}
            <div className="nav-desktop-items">
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
            </div>
          </nav>
        </div>
      </div>

      {/* ── Category bar (desktop) ───────────────────────────────────── */}
      <nav className="nav-cats-bar nav-cats-bar-desktop" aria-label="Browse by category">
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

      {/* ── Mobile menu drawer ───────────────────────────────────────── */}
      {mobileMenuOpen && (
        <>
          <div 
            className="nav-mobile-overlay" 
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="nav-mobile-drawer">
            {/* Mobile search */}
            <form className="nav-search nav-search-mobile" onSubmit={handleSearch} role="search">
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

            {/* Mobile categories */}
            <div className="nav-mobile-categories">
              <h3 className="nav-mobile-section-title">Categories</h3>
              <div className="nav-mobile-cat-list">
                {isLoading
                  ? [1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="nav-cat-skeleton" />
                    ))
                  : categories.map((cat) => {
                      const hasDomains = cat.domains?.length > 0;
                      const isExpanded = expandedCategory === cat.slug;
                      return (
                        <div key={cat.slug} className="nav-mobile-cat-group">
                          {hasDomains ? (
                            <button
                              className={`nav-mobile-cat-btn${isExpanded ? " expanded" : ""}`}
                              onClick={() => toggleCategory(cat.slug, hasDomains)}
                              aria-expanded={isExpanded}
                              aria-controls={`domains-${cat.slug}`}
                            >
                              <span>{cat.name}</span>
                              <ChevronDown 
                                size={16} 
                                className="nav-mobile-cat-chevron"
                                style={{ 
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s ease'
                                }}
                              />
                            </button>
                          ) : (
                            <Link
                              to={`/domain/${cat.slug}`}
                              className="nav-mobile-cat-link"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {cat.name}
                            </Link>
                          )}
                          {hasDomains && isExpanded && (
                            <div 
                              id={`domains-${cat.slug}`}
                              className="nav-mobile-domain-list"
                            >
                              {cat.domains.map((domain) => (
                                <Link
                                  key={domain.slug}
                                  to={`/domain/${domain.slug}`}
                                  className="nav-mobile-domain-link"
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  {domain.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
              </div>
            </div>

            {/* Mobile auth section */}
            {!isAuthenticated && (
              <div className="nav-mobile-auth">
                <button
                  type="button"
                  className="nav-register nav-register-btn nav-mobile-signin"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    goModal("/login");
                  }}
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}

export default Navbar;
