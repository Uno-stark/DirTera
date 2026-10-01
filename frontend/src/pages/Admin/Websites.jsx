import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import api from "../../api/client";

function Websites() {
  const [searchParams] = useSearchParams();

  const status = searchParams.get("status") || "";
const premiered = searchParams.get("premiered") === "true";

  const [websites, setWebsites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // admin flags modal
  const [flagTarget, setFlagTarget] = useState(null);
  const [flags, setFlags] = useState({
    is_premiered: false,
    is_verified: false,
  });
  const [savingFlags, setSavingFlags] = useState(false);
  const [flagError, setFlagError] = useState("");

  const [actingId, setActingId] = useState(null);

  const loadWebsites = async () => {
    setIsLoading(true);
    setError("");

    try {
      const params = {};

      if (status) {
        params.status = status;
      }
      if (premiered) {
  params.is_premiered = true;
}
      const { data } = await api.get(
        "/api/v1/websites/admin/all",
        { params }
      );

     const websiteList = data.items ?? data;

const filteredWebsites = premiered
  ? websiteList.filter((site) => site.is_premiered === true)
  : websiteList;

setWebsites(filteredWebsites);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to load websites."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWebsites();
  }, [status, premiered]);

  // --- Approve ---
  const approve = async (site) => {
    setActingId(site.id);

    try {
      await api.post(`/api/v1/websites/${site.id}/approve`);

      await loadWebsites();
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          "Failed to approve."
      );
    } finally {
      setActingId(null);
    }
  };

  // --- Reject modal ---
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
      await api.post(
        `/api/v1/websites/${rejectTarget.id}/reject`,
        {
          rejection_message: rejectionMessage,
        }
      );

      setRejectTarget(null);

      await loadWebsites();
    } catch (err) {
      setRejectError(
        err.response?.data?.detail ||
          "Failed to reject."
      );
    } finally {
      setRejecting(false);
    }
  };

  // --- Admin flags modal ---
  const openFlags = (site) => {
    setFlagTarget(site);

    setFlags({
      is_premiered: site.is_premiered,
      is_verified: site.is_verified,
    });

    setFlagError("");
  };

  const saveFlags = async (e) => {
    e.preventDefault();

    setSavingFlags(true);
    setFlagError("");

    try {
      const { data } = await api.patch(
        `/api/v1/websites/${flagTarget.id}/admin`,
        flags
      );

      setWebsites((prev) =>
        prev.map((w) =>
          w.id === flagTarget.id
            ? {
                ...w,
                is_premiered: data.is_premiered,
                is_verified: data.is_verified,
              }
            : w
        )
      );

      setFlagTarget(null);
    } catch (err) {
      setFlagError(
        err.response?.data?.detail ||
          "Failed to update flags."
      );
    } finally {
      setSavingFlags(false);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === "approved") {
      return "admin-badge admin-badge-approved";
    }

    if (status === "rejected") {
      return "admin-badge admin-badge-rejected";
    }

    return "admin-badge admin-badge-pending";
  };

  const getPageTitle = () => {
    if (status === "approved") return "Approved Websites";
    if (status === "pending") return "Pending Websites";
    if (status === "rejected") return "Rejected Websites";

    return "Websites";
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">
        {getPageTitle()}
      </h1>

      {error && (
        <p className="admin-error">
          {error}
        </p>
      )}

      {isLoading && (
        <p style={{ color: "#6b7280" }}>
          Loading websites…
        </p>
      )}

      {!isLoading && !error && websites.length === 0 && (
        <div className="admin-card">
          <p className="admin-empty">
            No websites found.
          </p>
        </div>
      )}

      {!isLoading && websites.length > 0 && (
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
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-link"
                      >
                        {site.name}
                      </a>
                    </td>

                    <td>
                      {site.owner?.email ?? "—"}
                    </td>

                    <td>
                      {site.category_slug ?? "—"}
                    </td>

                    <td>
                      <span
                        className={statusBadgeClass(
                          site.status
                        )}
                      >
                        {site.status}
                      </span>
                    </td>

                    <td>
                      {site.is_premiered ? (
                        <Check size={14} />
                      ) : (
                        <Minus
                          size={14}
                          color="#9ca3af"
                        />
                      )}
                    </td>

                    <td>
                      {site.is_verified ? (
                        <Check size={14} />
                      ) : (
                        <Minus
                          size={14}
                          color="#9ca3af"
                        />
                      )}
                    </td>

                    <td>
                      <div className="admin-action-row">
                        {site.status !== "approved" && (
                          <button
                            className="admin-button-sm admin-button-green"
                            disabled={
                              actingId === site.id
                            }
                            onClick={() =>
                              approve(site)
                            }
                          >
                            Approve
                          </button>
                        )}

                        {site.status !== "rejected" && (
                          <button
                            className="admin-button-sm admin-button-red"
                            onClick={() =>
                              openReject(site)
                            }
                          >
                            Reject
                          </button>
                        )}

                        <button
                          className="admin-button-sm"
                          onClick={() =>
                            openFlags(site)
                          }
                        >
                          Flags
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>
              Reject "{rejectTarget.name}"
            </h2>

            <form
              className="admin-form"
              onSubmit={confirmReject}
            >
              <label>
                Rejection message

                <textarea
                  className="admin-textarea"
                  rows={4}
                  value={rejectionMessage}
                  onChange={(e) =>
                    setRejectionMessage(
                      e.target.value
                    )
                  }
                  placeholder="Explain why this listing is being rejected…"
                  required
                />
              </label>

              {rejectError && (
                <p className="admin-error">
                  {rejectError}
                </p>
              )}

              <div className="admin-form-row">
                <button
                  type="submit"
                  className="admin-button admin-button-red-solid"
                  disabled={rejecting}
                >
                  {rejecting
                    ? "Rejecting…"
                    : "Confirm reject"}
                </button>

                <button
                  type="button"
                  className="admin-button-outline"
                  onClick={() =>
                    setRejectTarget(null)
                  }
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Flags modal */}
      {flagTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setFlagTarget(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>
              Flags — "{flagTarget.name}"
            </h2>

            <form
              className="admin-form"
              onSubmit={saveFlags}
            >
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={flags.is_premiered}
                  onChange={(e) =>
                    setFlags((f) => ({
                      ...f,
                      is_premiered:
                        e.target.checked,
                    }))
                  }
                />

                Premiered
              </label>

              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={flags.is_verified}
                  onChange={(e) =>
                    setFlags((f) => ({
                      ...f,
                      is_verified:
                        e.target.checked,
                    }))
                  }
                />

                Verified
              </label>

              {flagError && (
                <p className="admin-error">
                  {flagError}
                </p>
              )}

              <div className="admin-form-row">
                <button
                  type="submit"
                  className="admin-button"
                  disabled={savingFlags}
                >
                  {savingFlags
                    ? "Saving…"
                    : "Save flags"}
                </button>

                <button
                  type="button"
                  className="admin-button-outline"
                  onClick={() =>
                    setFlagTarget(null)
                  }
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

export default Websites;
