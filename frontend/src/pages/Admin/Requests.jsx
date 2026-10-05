import { useEffect, useState } from "react";
import api from "../../api/client";

function Requests() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [actingId, setActingId] = useState(null);

  const loadRequests = async (p = page) => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/v1/admin/requests", {
        params: { page: p, page_size: 20 },
      });
      const items = Array.isArray(data) ? data : data.items ?? [];
      setRequests(items);
      setTotalPages(data.total_pages ?? 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load pending requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(page);
  }, [page]);

  const approve = async (site) => {
    setActingId(site.id);
    try {
      await api.post(`/api/v1/websites/${site.id}/approve`);
      setRequests((prev) => prev.filter((r) => r.id !== site.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to approve.");
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
    if (!rejectionMessage.trim()) {
      setRejectError("Rejection message is required.");
      return;
    }
    setRejecting(true);
    setRejectError("");
    try {
      await api.post(`/api/v1/websites/${rejectTarget.id}/reject`, {
        rejection_message: rejectionMessage,
      });
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
      <h1 className="admin-page-title">Pending Requests</h1>
      <p className="admin-subtitle">Listings awaiting review and approval.</p>

      {error && <p className="admin-error">{error}</p>}
      {isLoading && <p style={{ color: "#6b7280" }}>Loading…</p>}

      {!isLoading && !error && requests.length === 0 && (
        <div className="admin-card">
          <p className="admin-empty">No pending requests.</p>
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Owner</th>
                  <th>Category</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((site) => (
                  <tr key={site.id}>
                    <td>{site.name}</td>
                    <td>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-link"
                      >
                        {site.url}
                      </a>
                    </td>
                    <td>{site.owner?.email ?? "—"}</td>
                    <td>{site.category_slug ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(site.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          className="admin-button-sm admin-button-green"
                          disabled={actingId === site.id}
                          onClick={() => approve(site)}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-button-sm admin-button-red"
                          onClick={() => openReject(site)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="pagination-button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="pagination-button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="admin-modal-backdrop" onClick={() => setRejectTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reject "{rejectTarget.name}"</h2>
            <form className="admin-form" onSubmit={confirmReject}>
              <label>
                Rejection message
                <textarea
                  className="admin-textarea"
                  rows={4}
                  value={rejectionMessage}
                  onChange={(e) => setRejectionMessage(e.target.value)}
                  placeholder="Explain why this listing is being rejected…"
                  required
                />
              </label>
              {rejectError && <p className="admin-error">{rejectError}</p>}
              <div className="admin-form-row">
                <button
                  type="submit"
                  className="admin-button admin-button-red-solid"
                  disabled={rejecting}
                >
                  {rejecting ? "Rejecting…" : "Confirm reject"}
                </button>
                <button
                  type="button"
                  className="admin-button-outline"
                  onClick={() => setRejectTarget(null)}
                >
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

export default Requests;
