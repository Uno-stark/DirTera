import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BarChart2, Search, X } from "lucide-react";

import { useAuth }     from "../context/AuthContext";
import { useTaxonomy } from "../context/TaxonomyContext";
import logoSrc         from "../assets/logo.js";
import "../styles/navbar.css";

// ── Portal dropdown — rendered in document.body so it escapes all overflow ───
function DomainPortal({ category, anchorRef }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!anchorRef.current) return;

    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef]);

  if (!rect) return null;

  return createPortal(
    <div
      className="nav-domain-portal"
      style={{
        top:  rect.bottom + 4,
        left: rect.left,
      }}
      role="list"
      aria-label={`${category.name} domains`}
    >
      <p className="nav-domain-box-heading">{category.name}</p>
      <div className="nav-domain-pills">
        {category.domains.map((domain) => (
          <Link
            key={domain.slug}
            to={`/?category=${category.slug}&domain=${domain.slug}`}
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
  const anchorRef = useRef(null);
  const closeTimer = useRef(null);

  const show = () => { clearTimeout(closeTimer.current); setOpen(true);  };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 100); };

  // Close on route change (link click)
  const close = () => setOpen(false);

  return (
    <div
      className="nav-cat-wrapper"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Link
        ref={anchorRef}
        to={`/?category=${category.slug}`}
        className={`nav-cat-link ${open ? "active" : ""}`}
        onClick={close}
      >
        {category.name}
      </Link>

      {hasDomains && open && (
        <DomainPortal
          category={category}
          anchorRef={anchorRef}
        />
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { categories, isLoading }         = useTaxonomy();
  const navigate                          = useNavigate();
  const location                          = useLocation();
  const [query, setQuery]                 = useState("");

  // Navigate to auth pages as modal (pass background location in state)
  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : "/");
  };

  const clearSearch = () => { setQuery(""); navigate("/"); };

  return (
    <header className="site-header">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="nav-top">
        <div className="nav-container">
          <Link to="/" className="site-logo" aria-label="DirTera home">
            {logoSrc ? (
              <img src={logoSrc} alt="DirTera" className="logo-image" />
            ) : (
              <>
                <BarChart2 size={22} className="logo-icon" strokeWidth={2} aria-hidden="true" />
                <span className="logo-wordmark">DirTera</span>
              </>
            )}
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
                {user?.is_admin && (
                  <Link to="/admin/dashboard" className="nav-link">Admin</Link>
                )}
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <button type="button" className="nav-button" onClick={logout}>
                  Sign out
                </button>
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
