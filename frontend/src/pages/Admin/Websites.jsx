import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search, X, CheckCircle2, XCircle, Flag, ChevronLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import api from "../../api/client";
import { fetchAdminAll, keys } from "../../api/queries";
import { Toast, useToast } from "../../components/admin/Toast";

const PAGE_SIZE = 20;

function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/* ── Status badge ── */
function StatusBadge({ status }) {
  const cls =
    status === "approved" ? "admin-badge admin-badge-approved" :
    status === "rejected" ? "admin-badge admin-badge-rejected" :
    "admin-badge admin-badge-pending";
  return <span className={cls}>{status}</span>;
}

/* ── Skeleton rows ── */
function SkeletonRows({ count = 10 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 140 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 70, borderRadius: 999 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 60, borderRadius: 999 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 60, borderRadius: 999 }} /></td>
      <td><div style={{ display: "flex", gap: 6 }}>
        {[60, 55, 50].map((w, j) => <div key={j} className="skeleton skeleton-cell" style={{ width: w, height: 24, borderRadius: 5 }} />)}
      </div></td>
    </tr>
  ));
}

/* ── Pagination ── */
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
      <span className="admin-pagination-info">Showing {start}–{end} of {total.toLocaleString()}</span>
      <div className="admin-pagination-btns">
        <button className="admin-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous">
          <ChevronLeft size={13} />
        </button>
        {pages.flatMap((p, i, arr) => {
          const btn = (
            <button key={p} className={`admin-page-btn${p === page ? " active" : ""}`}
              onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}>{p}</button>
          );
          return i > 0 && p - arr[i - 1] > 1
            ? [<span key={`e${p}`} style={{ padding: "0 2px", color: "#9ca3af", fontSize: 12 }}>…</span>, btn]
            : [btn];
        })}
        <button className="admin-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages} aria-label="Next">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Modal ── */
function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{title}</h2>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main ── */
function Websites() {
  const { toasts, toast, dismissToast } = useToast();
  const [searchParams]  = useSearchParams();
  const queryClient     = useQueryClient();

  const statusFilter = searchParams.get("status") || "";
  const premiered    = searchParams.get("premiered") === "true";

  const [page,        setPage]        = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => { setPage(1); }, [statusFilter, premiered, debouncedSearch]);

  const queryParams = useMemo(() => {
    const p = { page, page_size: PAGE_SIZE };
    if (statusFilter)    p.status = statusFilter;
    if (premiered)       p.is_premiered = true;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [page, statusFilter, premiered, debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: keys.adminAll(queryParams),
    queryFn:  () => fetchAdminAll(queryParams),
    placeholderData: (prev) => prev,
  });

  const websites   = data?.items       ?? [];
  const total      = data?.total       ?? 0;
  const totalPages = data?.total_pages ?? 1;

  useEffect(() => {
    if (page < totalPages) {
      const next = { ...queryParams, page: page + 1 };
      queryClient.prefetchQuery({ queryKey: keys.adminAll(next), queryFn: () => fetchAdminAll(next) });
    }
  }, [page, totalPages, queryParams, queryClient]);

  // Reject modal
  const [rejectTarget,     setRejectTarget]     = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [rejectError,      setRejectError]      = useState("");
  const [rejecting,        setRejecting]        = useState(false);

  // Flags modal
  const [flagTarget,  setFlagTarget]  = useState(null);
  const [flags,       setFlags]       = useState({ is_premiered: false, is_verified: false });
  const [savingFlags, setSavingFlags] = useState(false);
  const [flagError,   setFlagError]   = useState("");

  const [actingId, setActingId] = useState(null);

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["admin", "websites"] });

  /* ── Approve ── */
  const approve = async (site) => {
    setActingId(site.id);
    try {
      await api.post(`/api/v1/websites/${site.id}/approve`);
      toast(`"${site.name}" approved.`);
      await refetch();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to approve.", "error");
    } finally {
      setActingId(null);
    }
  };

  /* ── Reject ── */
  const openReject = (site) => {
    setRejectTarget(site);
    setRejectionMessage("");
    setRejectError("");
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionMessage.trim()) { setRejectError("Rejection message is required."); return; }
    setRejecting(true);
    try {
      await api.post(`/api/v1/websites/${rejectTarget.id}/reject`, { rejection_message: rejectionMessage });
      toast(`"${rejectTarget.name}" rejected.`);
      setRejectTarget(null);
      await refetch();
    } catch (err) {
      setRejectError(err.response?.data?.detail || "Failed to reject.");
    } finally {
      setRejecting(false);
    }
  };

  /* ── Flags ── */
  const openFlags = (site) => {
    setFlagTarget(site);
    setFlags({ is_premiered: site.is_premiered, is_verified: site.is_verified });
    setFlagError("");
  };

  const saveFlags = async (e) => {
    e.preventDefault();
    setSavingFlags(true);
    try {
      await api.patch(`/api/v1/websites/${flagTarget.id}/admin`, flags);
      toast(`Flags updated for "${flagTarget.name}".`);
      setFlagTarget(null);
      await refetch();
    } catch (err) {
      setFlagError(err.response?.data?.detail || "Failed to update flags.");
    } finally {
      setSavingFlags(false);
    }
  };

  const pageTitle =
    premiered                   ? "Premiered Websites" :
    statusFilter === "approved" ? "Approved Websites"  :
    statusFilter === "pending"  ? "Pending Websites"   :
    statusFilter === "rejected" ? "Rejected Websites"  : "Websites";

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{pageTitle}</h1>
          {!isLoading && (
            <p className="admin-subtitle">{total.toLocaleString()} website{total !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-wrap">
          <Search size={13} className="admin-search-icon" />
          <input
            type="search"
            className="admin-search"
            placeholder="Search by name or URL…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button className="admin-search-clear" onClick={() => setSearchInput("")} aria-label="Clear">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {isError && (
        <div className="admin-error" style={{ marginBottom: 14 }}>Failed to load websites.</div>
      )}

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Premiered</th>
                <th>Verified</th>
                <th style={{ minWidth: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={10} />
              ) : websites.length === 0 ? (
                <tr><td colSpan={5}>
                  <p className="admin-empty">
                    {debouncedSearch ? `No results for "${debouncedSearch}".` : "No websites found."}
                  </p>
                </td></tr>
              ) : (
                websites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <a href={site.url} target="_blank" rel="noreferrer" className="admin-link">
                          {site.name}
                        </a>
                        <Link
                          to={`/businesses/${site.id}`}
                          title="View business page"
                          style={{
                            display: "inline-flex", alignItems: "center",
                            color: "#9ca3af", flexShrink: 0,
                            transition: "color 0.15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "#6366f1"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "#9ca3af"}
                        >
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </td>
                    <td><StatusBadge status={site.status} /></td>
                    <td>
                      {site.is_premiered
                        ? <span className="admin-badge admin-badge-blue">Premiered</span>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td>
                      {site.is_verified
                        ? <span className="admin-badge admin-badge-approved">Verified</span>
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 155 }}>
                        {/* Approve — occupies fixed slot, invisible when not applicable */}
                        <span style={{ display: "inline-flex", minWidth: 70 }}>
                          {site.status !== "approved" && (
                            <button
                              className="admin-btn-xs green"
                              disabled={actingId === site.id}
                              onClick={() => approve(site)}
                            >
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}
                        </span>
                        {/* Reject — fixed slot */}
                        <span style={{ display: "inline-flex", minWidth: 60 }}>
                          {site.status !== "rejected" && (
                            <button
                              className="admin-btn-xs red"
                              onClick={() => openReject(site)}
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          )}
                        </span>
                        <button
                          className="admin-btn-xs neutral"
                          onClick={() => openFlags(site)}
                        >
                          <Flag size={12} /> Flags
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

      {/* ── Reject modal ── */}
      {rejectTarget && (
        <Modal title={`Reject "${rejectTarget.name}"`} onClose={() => setRejectTarget(null)}>
          <form className="admin-form" onSubmit={confirmReject}>
            <div className="admin-field">
              <label>Rejection message</label>
              <textarea
                className="admin-textarea"
                rows={4}
                value={rejectionMessage}
                onChange={(e) => setRejectionMessage(e.target.value)}
                placeholder="Explain why this listing is being rejected…"
                required
                autoFocus
              />
            </div>
            {rejectError && <div className="admin-error" style={{ fontSize: 13 }}>{rejectError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={rejecting}
                style={{ background: "#dc2626" }}>
                {rejecting ? "Rejecting…" : "Confirm reject"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Flags modal ── */}
      {flagTarget && (
        <Modal title={`Flags — "${flagTarget.name}"`} onClose={() => setFlagTarget(null)}>
          <form className="admin-form" onSubmit={saveFlags}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={flags.is_premiered}
                onChange={(e) => setFlags((f) => ({ ...f, is_premiered: e.target.checked }))}
              />
              Premiered
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={flags.is_verified}
                onChange={(e) => setFlags((f) => ({ ...f, is_verified: e.target.checked }))}
              />
              Verified
            </label>
            {flagError && <div className="admin-error" style={{ fontSize: 13 }}>{flagError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setFlagTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={savingFlags}>
                {savingFlags ? "Saving…" : "Save flags"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Websites;
