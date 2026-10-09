import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck, ChevronLeft, ChevronRight, Star } from "lucide-react";

import { fetchDomainWebsites, keys } from "../api/queries";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { useTaxonomy } from "../context/TaxonomyContext";
import "../styles/domain.css";

const PAGE_SIZE = 10;
const API_BASE  = import.meta.env.VITE_API_URL || "";

const FILTERS = [
  { key: "all",       label: "All"       },
  { key: "top_rated", label: "Top Rated" },
  { key: "premiered", label: "Premiered" },
];

// ── Inline star row ────────────────────────────────────────────────────────────
function StarRow({ value, count }) {
  const full  = Math.round(value);
  const empty = 5 - full;
  return (
    <span className="di-stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: full  }).map((_, i) => (
        <Star key={`f${i}`} size={12} fill="currentColor" strokeWidth={0} className="di-star-filled" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={12} fill="none" strokeWidth={1.5} className="di-star-empty" />
      ))}
      <span className="di-star-score">{value.toFixed(1)}</span>
      {count > 0 && <span className="di-star-count">({count})</span>}
    </span>
  );
}

// ── Single website row ────────────────────────────────────────────────────────
function WebsiteRow({ business, index, page }) {
  const globalIndex = (page - 1) * PAGE_SIZE + index + 1;
  const visitUrl    = `${API_BASE}/api/v1/websites/${business.id}/click`;

  return (
    <div className={`di-row${business.is_premiered ? " di-row-premiered" : ""}`}>
      <span className="di-row-index" aria-hidden="true">{String(globalIndex).padStart(2, "0")}</span>

      <div className="di-row-logo">
        {business.logo_url ? (
          <img src={business.logo_url} alt="" loading="lazy" />
        ) : (
          <span className="di-row-logo-placeholder" aria-hidden="true">
            {business.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="di-row-info">
        <div className="di-row-name-row">
          <Link to={`/businesses/${business.id}`} className="di-row-name">
            {business.name}
          </Link>
          {business.is_premiered && (
            <span className="di-row-badge di-badge-premier">Premier</span>
          )}
          {business.is_verified && (
            <span className="di-row-badge di-badge-verified">
              <BadgeCheck size={10} strokeWidth={2.5} />
              Verified
            </span>
          )}
        </div>

        <div className="di-row-meta">
          {business.avg_rating > 0 && (
            <StarRow value={business.avg_rating} count={business.review_count} />
          )}
          {business.domain_slug && (
            <span className="di-row-domain">
              {business.domain_slug.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {business.short_description && (
          <p className="di-row-desc">{business.short_description}</p>
        )}
      </div>

      <a href={visitUrl} target="_blank" rel="noreferrer"
        className="di-row-visit" aria-label={`Visit ${business.name}`}>
        Visit website
        <ArrowUpRight size={13} strokeWidth={2} />
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function DomainIndex() {
  const { domainSlug } = useParams();
  const { categories } = useTaxonomy();
  const navigate       = useNavigate();

  const [filter, setFilter] = useState("all");
  const [page,   setPage]   = useState(1);

  // Derive metadata once — no recompute on unrelated renders
  const domainMeta = useMemo(
    () => categories.flatMap((c) => c.domains ?? []).find((d) => d.slug === domainSlug),
    [categories, domainSlug]
  );
  const categoryMeta = useMemo(
    () => categories.find((c) => c.domains?.some((d) => d.slug === domainSlug)),
    [categories, domainSlug]
  );

  // Reset page when filter or domain changes
  useEffect(() => { setPage(1); }, [filter, domainSlug]);

  const queryParams = { domainSlug, filter, page, pageSize: PAGE_SIZE };

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: keys.domainWebsites(domainSlug, { filter, page }),
    queryFn:  () => fetchDomainWebsites(queryParams),
    // Keep previous page data visible while the next page loads
    placeholderData: (prev) => prev,
  });

  const rawItems  = data?.items       ?? [];
  const total     = data?.total       ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Pin premiered items to top client-side for "all" and "top_rated" filters
  const websites = useMemo(
    () =>
      filter !== "premiered"
        ? [...rawItems].sort((a, b) => {
            if (a.is_premiered && !b.is_premiered) return -1;
            if (!a.is_premiered && b.is_premiered) return 1;
            return b.avg_rating - a.avg_rating;
          })
        : rawItems,
    [rawItems, filter]
  );

  // Page number pills for pagination widget
  const pageNumbers = useMemo(() => {
    const pages = new Set();
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) pages.add(p);
    }
    return [...pages].sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <>
      <Navbar />

      <main className="di-page">
        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="di-header">
          <div className="di-header-inner">
            <nav className="di-breadcrumb" aria-label="Breadcrumb">
              <button type="button" className="di-breadcrumb-link" onClick={() => navigate(-1)}>
                <ChevronLeft size={13} />
                Directory
              </button>
              <span className="di-breadcrumb-sep" aria-hidden="true">›</span>
              {categoryMeta && (
                <>
                  <span className="di-breadcrumb-cat">{categoryMeta.name}</span>
                  <span className="di-breadcrumb-sep" aria-hidden="true">›</span>
                </>
              )}
              <span className="di-breadcrumb-current">
                {domainMeta?.name ?? domainSlug.replace(/_/g, " ")}
              </span>
            </nav>

            <div className="di-header-row">
              <div>
                <h1>
                  Websites in{" "}
                  <span className="di-header-domain">
                    {domainMeta?.name ?? domainSlug.replace(/_/g, " ")}
                  </span>
                </h1>
                <p>
                  Explore registered websites in the{" "}
                  {domainMeta?.name ?? domainSlug.replace(/_/g, " ")} domain,
                  thoughtfully reviewed and organised in one place.
                </p>
              </div>

              {!isLoading && total > 0 && (
                <div className="di-index-pill">
                  <span className="di-index-label">Domain index</span>
                  <span className="di-index-value">
                    {String(page).padStart(2, "0")}&thinsp;/&thinsp;
                    {String(totalPages).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Listings ───────────────────────────────────────────────── */}
        <div className="di-body">
          <div className="di-body-inner">
            <div className="di-toolbar">
              <div className="di-toolbar-left">
                <h2 className="di-toolbar-heading">
                  {domainMeta?.name ?? domainSlug.replace(/_/g, " ")} Websites
                </h2>
                {!isLoading && (
                  <span className="di-toolbar-count">{total.toLocaleString()} registered websites</span>
                )}
              </div>

              <div className="di-toolbar-right">
                <span className="di-updated">Updated weekly</span>
                <div className="di-filters" role="tablist" aria-label="Filter websites">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" role="tab"
                      aria-selected={filter === f.key}
                      className={`di-filter-tab${filter === f.key ? " active" : ""}`}
                      onClick={() => setFilter(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isError && (
              <div className="di-state di-error" role="alert">Couldn't load listings.</div>
            )}

            {isLoading && (
              <div className="di-list">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="di-skeleton" />
                ))}
              </div>
            )}

            {!isLoading && !isError && websites.length === 0 && (
              <div className="di-state">
                No websites found{filter !== "all"
                  ? ` for "${FILTERS.find(f => f.key === filter)?.label}"`
                  : ""}.
              </div>
            )}

            {!isLoading && !isError && websites.length > 0 && (
              <div className={`di-list${isFetching ? " di-list-loading" : ""}`}>
                {isFetching && <div className="di-page-loader" aria-label="Loading" />}
                {websites.map((biz, i) => (
                  <WebsiteRow key={biz.id} business={biz} index={i} page={page} />
                ))}
              </div>
            )}

            {!isLoading && totalPages > 1 && (
              <div className="di-pagination">
                <span className="di-pagination-info">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} websites
                </span>
                <div className="di-pagination-controls">
                  <button type="button" className="di-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1} aria-label="Previous page">
                    <ChevronLeft size={15} />
                  </button>

                  {pageNumbers.flatMap((p, idx, arr) => {
                    const btn = (
                      <button key={p} type="button"
                        className={`di-page-num${p === page ? " active" : ""}`}
                        onClick={() => setPage(p)}
                        aria-current={p === page ? "page" : undefined}>
                        {p}
                      </button>
                    );
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      return [<span key={`ellipsis-${p}`} className="di-page-ellipsis">…</span>, btn];
                    }
                    return [btn];
                  })}

                  <button type="button" className="di-page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages} aria-label="Next page">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}

export default DomainIndex;
