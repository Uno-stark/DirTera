import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Minus, Search, X } from "lucide-react";
import api from "../../api/client";
import { fetchAdminAll, keys } from "../../api/queries";

const PAGE_SIZE = 20;

function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Websites() {
  const [searchParams]  = useSearchParams();
  const queryClient     = useQueryClient();

  const statusFilter = searchParams.get("status") || "";
  const premiered    = searchParams.get("premiered") === "true";

  const [page,        setPage]        = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  // Reset to page 1 when filters or search term change
  useEffect(() => { setPage(1); }, [statusFilter, premiered, debouncedSearch]);

  // ── Query params ──────────────────────────────────────────────────────────
  const queryParams = useMemo(() => {
    const p = { page, page_size: PAGE_SIZE };
    if (statusFilter) p.status = statusFilter;
    if (premiered)    p.is_premiered = true;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [page, statusFilter, premiered, debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: keys.adminAll(queryParams),
    queryFn:  () => fetchAdminAll(queryParams),
    // Keep previous page data visible while next page loads
    placeholderData: (prev) => prev,
  });

  const websites   = data?.items       ?? [];
  const total      = data?.total       ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Prefetch next page
  useEffect(() => {
    if (page < totalPages) {
      const next = { ...queryParams, page: page + 1 };
      queryClient.prefetchQuery({
        queryKey: keys.adminAll(next),
        queryFn:  () => fetchAdminAll(next),
      });
    }
  }, [page, totalPages, queryParams, queryClient]);

  // ── Reject modal ──────────────────────────────────────────────────────────
  const [rejectTarget,      setRejectTarget]      = useState(null);
  const [rejectionMessage,  setRejectionMessage]  = useState("");
  const [rejectError,       setRejectError]       = useState("");
  const [rejecting,         setRejecting]         = useState(false);

  // ── Flags modal ───────────────────────────────────────────────────────────
  const [flagTarget,  setFlagTarget]  = useState(null);
  const [flags,       setFlags]       = useState({ is_premiered: false, is_verified: false });
  const [savingFlags, setSavingFlags] = useState(false);
  const [flagError,   setFlagError]   = useState("");

  const [actingId, setActingId] = useState(null);

  // Helper to refetch current page after a mutation
  const refetchCurrent = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "websites"] });

  // ── Approve ───────────────────────────────────────────────────────────────
  const approve = async (site) => {
    setActingId(site.id);
    try {
      await api.post(`/api/v1/websites/${site.id}/approve`);
      await refetchCurrent();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve.");
    } finally {
      setActingId(null);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const openReject = (site) => {
    setRejectTarget(site);
    setRejectionMessage("");
    setRejectError("");
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionMessage.trim()) { setRejectError("Rejection message is required."); return; }
    setRejecting(true);
    setRejectError("");
    try {
      await api.post(`/api/v1/websites/${rejectTarget.id}/reject`, {
        rejection_message: rejectionMessage,
      });
      setRejectTarget(null);
      await refetchCurrent();
    } catch (err) {
      setRejectError(err.response?.data?.detail || "Failed to reject.");
    } finally {
      setRejecting(false);
    }
  };

  // ── Flags ─────────────────────────────────────────────────────────────────
  const openFlags = (site) => {
    setFlagTarget(site);
    setFlags({ is_premiered: site.is_premiered, is_verified: site.is_verified });
    setFlagError("");
  };

  const saveFlags = async (e) => {
    e.preventDefault();
    setSavingFlags(true);
    setFlagError("");
    try {
      await api.patch(`/api/v1/websites/${flagTarget.id}/admin`, flags);
      setFlagTarget(null);
      await refetchCurrent();
    } catch (err) {
      setFlagError(err.response?.data?.detail || "Failed to update flags.");
    } finally {
      setSavingFlags(false);
    }
  };

  const statusBadgeClass = (s) =>
    s === "approved" ? "admin-badge admin-badge-approved" :
    s === "rejected" ? "admin-badge admin-badge-rejected" :
    "admin-badge admin-badge-pending";

  const getPageTitle = () => {
    if (premiered)             return "Premiered Websites";
    if (statusFilter === "approved") return "Approved Websites";
    if (statusFilter === "pending")  return "Pending Websites";
    if (statusFilter === "rejected") return "Rejected Websites";
    return "Websites";
  };

  // Pagination pill builder
  const pageNumbers = useMemo(() => {
    const pages = new Set();
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) pages.add(p);
    }
    return [...pages].sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">{getPageTitle()}</h1>

      {/* ── Search bar ────────────────────────────────────────────────── */}
      <div className="admin-search-bar" style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="search"
            placeholder="Search by name, owner, or URL…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: "100%", padding: "8px 32px 8px 32px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}
          />
          {searchInput && (
            <button type="button" onClick={() => setSearchInput("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
              aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        {!isLoading && (
          <span style={{ alignSelf: "center", fontSize: 13, color: "#6b7280" }}>
            {total.toLocaleString()} website{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isError && <p className="admin-error">Failed to load websites.</p>}
      {isLoading && <p style={{ color: "#6b7280" }}>Loading websites…</p>}

      {!isLoading && !isError && websites.length === 0 && (
        <div className="admin-card">
          <p className="admin-empty">
            {debouncedSearch ? `No websites match "${debouncedSearch}".` : "No websites found."}
          </p>
        </div>
      )}

      {websites.length > 0 && (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Premiered</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {websites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <a href={site.url} target="_blank" rel="noreferrer" className="admin-link">
                        {site.name}
                      </a>
                    </td>
                    <td>{site.owner?.email ?? "—"}</td>
                    <td>{site.category_slug ?? "—"}</td>
                    <td><span className={statusBadgeClass(site.status)}>{site.status}</span></td>
                    <td>{site.is_premiered ? <Check size={14} /> : <Minus size={14} color="#9ca3af" />}</td>
                    <td>{site.is_verified  ? <Check size={14} /> : <Minus size={14} color="#9ca3af" />}</td>
                    <td>
                      <div className="admin-action-row">
                        {site.status !== "approved" && (
                          <button className="admin-button-sm admin-button-green"
                            disabled={actingId === site.id} onClick={() => approve(site)}>
                            Approve
                          </button>
                        )}
                        {site.status !== "rejected" && (
                          <button className="admin-button-sm admin-button-red" onClick={() => openReject(site)}>
                            Reject
                          </button>
                        )}
                        <button className="admin-button-sm" onClick={() => openFlags(site)}>
                          Flags
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button className="admin-button-outline" style={{ padding: "4px 8px" }}
                  onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  aria-label="Previous page">
                  <ChevronLeft size={14} />
                </button>

                {pageNumbers.flatMap((p, i, arr) => {
                  const btn = (
                    <button key={p}
                      style={{ padding: "4px 10px", border: "1px solid", borderRadius: 4, fontSize: 13, cursor: "pointer",
                        background: p === page ? "#111" : "transparent",
                        color:      p === page ? "#fff" : "#374151",
                        borderColor: p === page ? "#111" : "#e5e7eb" }}
                      onClick={() => setPage(p)} aria-current={p === page ? "page" : undefined}>
                      {p}
                    </button>
                  );
                  if (i > 0 && p - arr[i - 1] > 1) {
                    return [<span key={`e${p}`} style={{ padding: "0 4px", color: "#9ca3af" }}>…</span>, btn];
                  }
                  return [btn];
                })}

                <button className="admin-button-outline" style={{ padding: "4px 8px" }}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  aria-label="Next page">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reject modal ──────────────────────────────────────────────── */}
      {rejectTarget && (
        <div className="admin-modal-backdrop" onClick={() => setRejectTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reject "{rejectTarget.name}"</h2>
            <form className="admin-form" onSubmit={confirmReject}>
              <label>
                Rejection message
                <textarea className="admin-textarea" rows={4} value={rejectionMessage}
                  onChange={(e) => setRejectionMessage(e.target.value)}
                  placeholder="Explain why this listing is being rejected…" required />
              </label>
              {rejectError && <p className="admin-error">{rejectError}</p>}
              <div className="admin-form-row">
                <button type="submit" className="admin-button admin-button-red-solid" disabled={rejecting}>
                  {rejecting ? "Rejecting…" : "Confirm reject"}
                </button>
                <button type="button" className="admin-button-outline" onClick={() => setRejectTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Flags modal ───────────────────────────────────────────────── */}
      {flagTarget && (
        <div className="admin-modal-backdrop" onClick={() => setFlagTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Flags — "{flagTarget.name}"</h2>
            <form className="admin-form" onSubmit={saveFlags}>
              <label className="admin-checkbox-label">
                <input type="checkbox" checked={flags.is_premiered}
                  onChange={(e) => setFlags((f) => ({ ...f, is_premiered: e.target.checked }))} />
                Premiered
              </label>
              <label className="admin-checkbox-label">
                <input type="checkbox" checked={flags.is_verified}
                  onChange={(e) => setFlags((f) => ({ ...f, is_verified: e.target.checked }))} />
                Verified
              </label>
              {flagError && <p className="admin-error">{flagError}</p>}
              <div className="admin-form-row">
                <button type="submit" className="admin-button" disabled={savingFlags}>
                  {savingFlags ? "Saving…" : "Save flags"}
                </button>
                <button type="button" className="admin-button-outline" onClick={() => setFlagTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Websites;
