import { useEffect, useState } from "react";
import api from "../../api/client";
import { fmtDate, capitalize } from "../../utils/format";

const STATUS_CLASSES = {
  active:    "admin-badge admin-badge-approved",
  pending:   "admin-badge admin-badge-pending",
  expired:   "admin-badge admin-badge-rejected",
  cancelled: "admin-badge",
  failed:    "admin-badge admin-badge-rejected",
};

function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState("");

  useEffect(() => {
    api.get("/api/v1/admin/subscriptions")
      .then(({ data }) => setSubscriptions(data.items ?? data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load subscriptions."))
      .finally(() => setIsLoading(false));
  }, []);

  const activeCount    = subscriptions.filter((s) => s.status === "active").length;
  const pendingCount   = subscriptions.filter((s) => s.status === "pending").length;
  const expiredCount   = subscriptions.filter((s) => s.status === "expired" || s.status === "cancelled" || s.status === "failed").length;

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Subscriptions</h1>
      <p className="admin-subtitle">Platform-wide subscription overview.</p>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Active",  value: activeCount  },
          { label: "Pending", value: pendingCount  },
          { label: "Inactive", value: expiredCount },
          { label: "Total",   value: subscriptions.length },
        ].map(({ label, value }) => (
          <div key={label} className="admin-card" style={{ marginBottom: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6b7280" }}>{label}</p>
            <strong style={{ fontSize: 28, color: "#111827" }}>{isLoading ? "—" : value}</strong>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="admin-card">
        <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "#374151" }}>
          All Subscriptions
        </h2>

        {isLoading && <p>Loading…</p>}
        {!isLoading && error && <p className="admin-error">{error}</p>}
        {!isLoading && !error && subscriptions.length === 0 && (
          <p className="admin-empty">No subscriptions yet.</p>
        )}

        {!isLoading && !error && subscriptions.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Website</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.user?.email ?? sub.user_id ?? "—"}</td>
                    <td>{sub.website?.name ?? sub.website_id ?? "—"}</td>
                    <td>{capitalize(sub.plan)}</td>
                    <td>{Number(sub.amount).toLocaleString()} {sub.currency}</td>
                    <td>
                      <span className={STATUS_CLASSES[sub.status] ?? "admin-badge"}>
                        {capitalize(sub.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(sub.starts_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(sub.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSubscriptions;