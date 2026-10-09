import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";

const PAGE_SIZE = 20;

/* ── Skeleton rows ──────────────────────────────────────────────────────────── */
function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 130 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 180 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 120 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 70 }} /></td>
      <td><div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton skeleton-cell" style={{ width: 65, height: 24, borderRadius: 5 }} />
        <div className="skeleton skeleton-cell" style={{ width: 55, height: 24, borderRadius: 5 }} />
      </div></td>
    </tr>
  ));
}

/* ── Pagination ─────────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">Page {page} of {totalPages}</span>
      <div className="admin-pagination-btns">
        <button className="admin-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous">
          <ChevronLeft size={13} />
        </button>
        <button className="admin-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages} aria-label="Next">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────────── */
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

/* ── Main ───────────────────────────────────────────────────────────────────── */
function Requests() {
  const { toasts, toast, dismissToast } = useToast();

  const [requests,  setRequests]  = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page,      setPage]      = useState(1);
  const [totalPages,setTotalPages]= useState(1);
  const [actingId,  setActingId]  = useState(null);

  const [rejectTarget,     setRejectTarget]     = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [rejectError,      setRejectError]      = useState("");
  const [rejecting,        setRejecting]        = useState(false);

  const loadRequests = async (p = 1) => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/v1/admin/requests", {
        params: { page: p, page_size: PAGE_SIZE },
      });
      setRequests(Array.isArray(data) ? data : data.items ?? []);
      setTotalPages(data.total_pages ?? 1);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to load pending requests.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadRequests(page); }, [page]);

  const approve = async (site) => {
    setActingId(site.id);
    try {
      await api.post(`/api/v1/websites/${site.id}/approve`);
      toast(`"${site.name}" approved.`);
      setRequests((prev) => prev.filter((r) => r.id !== site.id));
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to approve.", "error");
    } finally {
      setActingId(null);
    }
  };

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
      toast(`"${rejectTarget.name}" rejected.`);
      setRequests((prev) => prev.filter((r) => r.id !== rejectTarget.id));
      setRejectTarget(null);
    } catch (err) {
      setRejectError(err.response?.data?.detail || "Failed to reject.");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Pending Requests</h1>
          <p className="admin-subtitle">Listings awaiting review and approval.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Owner</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={8} />
              ) : requests.length === 0 ? (
                <tr><td colSpan={5}><p className="admin-empty">No pending requests.</p></td></tr>
              ) : (
                requests.map((site) => (
                  <tr key={site.id}>
                    <td style={{ fontWeight: 500, color: "#111827" }}>{site.name}</td>
                    <td>
                      <a href={site.url} target="_blank" rel="noreferrer" className="admin-link"
                        style={{ fontSize: 12.5, color: "#6b7280" }}>
                        {site.url.replace(/^https?:\/\//, "")}
                      </a>
                    </td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{site.owner?.email ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap", color: "#9ca3af", fontSize: 12.5 }}>
                      {new Date(site.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          className="admin-btn-xs green"
                          disabled={actingId === site.id}
                          onClick={() => approve(site)}
                        >
                          <CheckCircle2 size={12} /> Approve
                        </button>
                        <button
                          className="admin-btn-xs red"
                          onClick={() => openReject(site)}
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

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
    </div>
  );
}

export default Requests;
