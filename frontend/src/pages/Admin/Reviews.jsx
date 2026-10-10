import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";
import { fmtDate } from "../../utils/format";
import { parseErrorMessage } from "../../utils/errorParser";

const PAGE_SIZE = 20;

/* ── Query key factory ───────────────────────────────────────────────────── */
const reviewKeys = {
  list: (page, search, visibilityFilter) => ["admin", "reviews", { page, search, visibilityFilter }],
};

/* ── Data fetcher ─────────────────────────────────────────────────────────── */
async function fetchReviews({ page, search, visibilityFilter }) {
  try {
    // Fetch websites with reviews - backend will include reviews in response
    const { data } = await api.get("/api/v1/websites/admin/all", { 
      params: { 
        page: 1,  // Fetch first page with high limit to get all reviews
        page_size: 100,  // Increased to get more reviews at once
        has_reviews: true 
      } 
    });
    
    // Extract and flatten reviews from websites
    const reviews = [];
    if (data && data.items && Array.isArray(data.items)) {
      for (const website of data.items) {
        if (website.reviews && Array.isArray(website.reviews) && website.reviews.length > 0) {
          website.reviews.forEach(review => {
            reviews.push({
              ...review,
              website_name: website.name,
              website_id: website.id,
            });
          });
        }
      }
    }
    
    // Apply visibility filter
    let filtered = reviews;
    if (visibilityFilter === "hidden") {
      filtered = reviews.filter(r => r.is_visible === false);
    } else if (visibilityFilter === "visible") {
      filtered = reviews.filter(r => r.is_visible === true);
    }
    
    // Apply search
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(r => 
        (r.body && r.body.toLowerCase().includes(lower)) ||
        (r.author_name && r.author_name.toLowerCase().includes(lower)) ||
        (r.website_name && r.website_name.toLowerCase().includes(lower))
      );
    }
    
    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Paginate
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedItems = filtered.slice(start, end);
    
    return {
      items: paginatedItems,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / PAGE_SIZE) || 1,
    };
  } catch (err) {
    console.error("Failed to fetch reviews:", err);
    // Fallback: return empty
    return { items: [], total: 0, totalPages: 1 };
  }
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRows({ count = 10 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 160 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 120 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 200 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 40 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 80 }} /></td>
      <td><div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton skeleton-cell" style={{ width: 60, height: 24 }} />
        <div className="skeleton skeleton-cell" style={{ width: 60, height: 24 }} />
      </div></td>
    </tr>
  ));
}

/* ── Pagination ──────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, total);
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) pages.push(p);
  }
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">{start}–{end} of {total.toLocaleString()}</span>
      <div className="admin-pagination-btns">
        <button className="admin-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.flatMap((p, i, arr) => {
          const btn = (
            <button
              key={p}
              className={`admin-page-btn${p === page ? " active" : ""}`}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          );
          return i > 0 && p - arr[i - 1] > 1
            ? [<span key={`e${p}`} style={{ padding: "0 2px", color: "#9ca3af", fontSize: 12 }}>…</span>, btn]
            : [btn];
        })}
        <button className="admin-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  );
}

/* ── Stars display ───────────────────────────────────────────────────────── */
function StarDisplay({ value }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, color: "#f59e0b" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i}>{i < value ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function Reviews() {
  const { toasts, toast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all"); // "all" | "visible" | "hidden"
  const [actingId, setActingId] = useState(null);

  /* Query */
  const { data, isLoading, isError } = useQuery({
    queryKey: reviewKeys.list(page, search, visibilityFilter),
    queryFn: () => fetchReviews({ page, search, visibilityFilter }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const reviews = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  /* Debounced search */
  const debounceRef = useState(() => ({ current: null }))[0];

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setDraftSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const clearSearch = () => {
    setDraftSearch("");
    setSearch("");
    setPage(1);
  };

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });

  /* ── Toggle visibility ── */
  const toggleVisibility = async (review) => {
    setActingId(review.id);
    const newVisibility = !review.is_visible;
    try {
      const response = await api.patch(`/api/v1/reviews/${review.id}/hide`, null, {
        params: { hide: !newVisibility },
      });
      console.log('Toggle visibility - Current state:', review.is_visible, 'New state:', response.data.is_visible);
      toast(`Review ${newVisibility ? "shown" : "hidden"}.`);
      // Force immediate refetch
      await queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] });
    } catch (err) {
      console.error('Toggle visibility error:', err.response || err);
      toast(parseErrorMessage(err, "Failed to update visibility."), "error");
    } finally {
      setActingId(null);
    }
  };

  /* ── Delete review ── */
  const deleteReview = async (review) => {
    if (!window.confirm(`Delete this review? This cannot be undone.`)) return;
    setActingId(review.id);
    try {
      await api.delete(`/api/v1/reviews/${review.id}/admin`);
      toast("Review deleted.");
      await refetch();
    } catch (err) {
      toast(parseErrorMessage(err, "Failed to delete review."), "error");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Review Moderation</h1>
          {!isLoading && (
            <p className="admin-subtitle">
              {total.toLocaleString()} review{total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <div className="admin-error" style={{ marginBottom: 14 }}>
          Failed to load reviews.
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-wrap">
          <Search size={13} className="admin-search-icon" />
          <input
            type="search"
            className="admin-search"
            placeholder="Search by content, author, or website…"
            value={draftSearch}
            onChange={handleSearchChange}
          />
          {draftSearch && (
            <button className="admin-search-clear" onClick={clearSearch} aria-label="Clear">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Visibility filter */}
        <select
          className="admin-select"
          value={visibilityFilter}
          onChange={(e) => {
            setVisibilityFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: 140, height: 36 }}
        >
          <option value="all">All reviews</option>
          <option value="visible">Visible only</option>
          <option value="hidden">Hidden only</option>
        </select>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Website</th>
                <th>Author</th>
                <th>Review</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={10} />
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="admin-empty">
                      {search ? `No reviews matching "${search}".` : "No reviews found."}
                    </p>
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} className={r.is_visible ? "" : "row-inactive"}>
                    <td>
                      <Link
                        to={`/businesses/${r.website_id}`}
                        style={{ color: "#4f46e5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {r.website_name}
                        <ExternalLink size={11} />
                      </Link>
                    </td>
                    <td style={{ fontSize: 13 }}>{r.author_name || "Anonymous"}</td>
                    <td style={{ fontSize: 13, maxWidth: 300 }}>
                      <div style={{ 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap",
                        opacity: r.is_visible ? 1 : 0.5,
                      }}>
                        {r.body || <em style={{ color: "#9ca3af" }}>No text</em>}
                      </div>
                    </td>
                    <td>
                      <StarDisplay value={r.rating} />
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13, color: "#6b7280" }}>
                      {fmtDate(r.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <button
                          className={`admin-btn-xs ${r.is_visible ? "neutral" : "blue"}`}
                          onClick={() => toggleVisibility(r)}
                          disabled={actingId === r.id}
                          title={r.is_visible ? "Hide review" : "Show review"}
                        >
                          {r.is_visible ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Show</>}
                        </button>
                        <button
                          className="admin-btn-xs red"
                          onClick={() => deleteReview(r)}
                          disabled={actingId === r.id}
                          title="Delete review permanently"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </div>
  );
}

export default Reviews;
