import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { fmtDate, capitalize } from "../../utils/format";

const STATUS_CLASSES = {
  active:    "admin-badge admin-badge-approved",
  pending:   "admin-badge admin-badge-pending",
  expired:   "admin-badge admin-badge-rejected",
  cancelled: "admin-badge",
  failed:    "admin-badge admin-badge-rejected",
};

/* ── Data fetcher ─────────────────────────────────────────────────────────── */
async function fetchAdminSubscriptions() {
  const { data } = await api.get("/api/v1/admin/subscriptions");
  return data.items ?? data;
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 160 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 110 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 60 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 60 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 70, borderRadius: 999 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 80 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 80 }} /></td>
    </tr>
  ));
}

/* ── Summary card ─────────────────────────────────────────────────────────── */
function SummaryCard({ label, value, loading }) {
  return (
    <div className="admin-card" style={{ marginBottom: 0 }}>
      <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
        {label}
      </p>
      {loading
        ? <div className="skeleton" style={{ height: 28, width: 60 }} />
        : <strong style={{ fontSize: 26, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{value}</strong>
      }
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
function AdminSubscriptions() {
  const { data: subscriptions = [], isLoading, isError } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn:  fetchAdminSubscriptions,
    staleTime: 60_000,
    retry: 1,
  });

  const activeCount  = subscriptions.filter((s) => s.status === "active").length;
  const pendingCount = subscriptions.filter((s) => s.status === "pending").length;
  const inactiveCount = subscriptions.filter(
    (s) => s.status === "expired" || s.status === "cancelled" || s.status === "failed"
  ).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Subscriptions</h1>
          <p className="admin-subtitle">Platform-wide subscription overview.</p>
        </div>
      </div>

      {/* Summary row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 14,
        marginBottom: 24,
      }}>
        <SummaryCard label="Active"   value={activeCount}   loading={isLoading} />
        <SummaryCard label="Pending"  value={pendingCount}  loading={isLoading} />
        <SummaryCard label="Inactive" value={inactiveCount} loading={isLoading} />
        <SummaryCard label="Total"    value={subscriptions.length} loading={isLoading} />
      </div>

      {/* Table */}
      <div className="admin-card">
        <h2 className="admin-card-title">All Subscriptions</h2>

        {isError && (
          <div className="admin-error" style={{ marginBottom: 14 }}>
            Failed to load subscriptions.
          </div>
        )}

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
              {isLoading ? (
                <SkeletonRows count={8} />
              ) : subscriptions.length === 0 && !isError ? (
                <tr>
                  <td colSpan={7}>
                    <p className="admin-empty">No subscriptions yet.</p>
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={{ fontSize: 13 }}>{sub.user?.email ?? sub.user_id ?? "—"}</td>
                    <td style={{ fontWeight: 500 }}>{sub.website?.name ?? sub.website_id ?? "—"}</td>
                    <td>{capitalize(sub.plan)}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {Number(sub.amount).toLocaleString()} {sub.currency}
                    </td>
                    <td>
                      <span className={STATUS_CLASSES[sub.status] ?? "admin-badge"}>
                        {capitalize(sub.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtDate(sub.starts_at)}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtDate(sub.expires_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminSubscriptions;
