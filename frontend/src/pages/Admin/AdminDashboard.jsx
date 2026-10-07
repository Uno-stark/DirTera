import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Globe,
  ClipboardList,
  CreditCard,
  Tag,
  Link,
} from "lucide-react";
import api from "../../api/client";

/* ─── Stats row ─────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, highlight, onClick }) {
  return (
    <div
      className="admin-card"
      onClick={onClick}
      style={{
        marginBottom: 0,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: highlight ? "3px solid #d97706" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
          {label}
        </span>
        {Icon && (
          <Icon
            size={18}
            style={{ color: highlight ? "#d97706" : "#9ca3af", flexShrink: 0 }}
          />
        )}
      </div>
      <strong
        style={{
          fontSize: 30,
          color: highlight ? "#d97706" : "#111827",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value ?? "—"}
      </strong>
    </div>
  );
}

/* ─── Shared mini-widget shell ───────────────────────────────── */

function DataWidget({ heading, loading, error, empty, children, footerLabel, footerPath, navigate }) {
  return (
    <div className="admin-card" style={{ marginBottom: 0 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
        {heading}
      </h2>

      {loading && (
        <p style={{ color: "#6b7280", fontSize: 14 }}>Loading...</p>
      )}

      {!loading && error && <p className="admin-error">{error}</p>}

      {!loading && !error && empty && (
        <p className="admin-empty">No data available.</p>
      )}

      {!loading && !error && !empty && children}

      <div style={{ marginTop: 12 }}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13, color: "#2563eb" }}
          onClick={() => navigate(footerPath)}
        >
          {footerLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

function AdminDashboard() {
  const navigate = useNavigate();

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  // Recent pending requests
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState("");

  // Recent users
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentUsersLoading, setRecentUsersLoading] = useState(true);
  const [recentUsersError, setRecentUsersError] = useState("");

  // Recent subscriptions
  const [recentSubscriptions, setRecentSubscriptions] = useState([]);
  const [recentSubscriptionsLoading, setRecentSubscriptionsLoading] = useState(true);
  const [recentSubscriptionsError, setRecentSubscriptionsError] = useState("");

  // Top websites
  const [topWebsites, setTopWebsites] = useState([]);
  const [topWebsitesLoading, setTopWebsitesLoading] = useState(true);
  const [topWebsitesError, setTopWebsitesError] = useState("");

  useEffect(() => {
    // Fetch stats
    api
      .get("/api/v1/admin/dashboard")
      .then(({ data }) => setStats(data))
      .catch(() => setStatsError("Failed to load dashboard stats."))
      .finally(() => setStatsLoading(false));

    // Fetch recent pending requests concurrently
    api
      .get("/api/v1/admin/requests", { params: { page: 1, page_size: 5 } })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        setRequests(items);
      })
      .catch(() => setReqError("Failed to load pending requests."))
      .finally(() => setReqLoading(false));

    // Fetch recent users
    api
      .get("/api/v1/users", { params: { page: 1, page_size: 5 } })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        setRecentUsers(items);
      })
      .catch(() => setRecentUsersError("Failed to load recent users."))
      .finally(() => setRecentUsersLoading(false));

    // Fetch recent subscriptions
    api
      .get("/api/v1/admin/subscriptions", { params: { page: 1, page_size: 5 } })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        setRecentSubscriptions(items);
      })
      .catch(() => setRecentSubscriptionsError("Failed to load recent subscriptions."))
      .finally(() => setRecentSubscriptionsLoading(false));

    // Fetch top websites
    api
      .get("/api/v1/websites/top", { params: { limit: 5, sort_by: "clicks" } })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        setTopWebsites(items);
      })
      .catch(() => setTopWebsitesError("Failed to load top websites."))
      .finally(() => setTopWebsitesLoading(false));
  }, []);

  if (statsLoading) {
    return (
      <div className="admin-page">
        <h1 className="admin-page-title">Admin Dashboard</h1>
        <p style={{ color: "#6b7280", marginTop: 24 }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <h1 className="admin-page-title">Admin Dashboard</h1>
      <p className="admin-subtitle">Platform-wide overview.</p>

      {statsError && <p className="admin-error">{statsError}</p>}

      {/* ── Stats row ─────────────────────────────────────── */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <StatCard
            label="Total Users"
            value={stats.users?.total}
            icon={Users}
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            label="Total Websites"
            value={stats.websites?.total}
            icon={Globe}
            onClick={() => navigate("/admin/websites")}
          />
          <StatCard
            label="Pending Websites"
            value={stats.websites?.pending}
            icon={ClipboardList}
            highlight={stats.websites?.pending > 0}
            onClick={() => navigate("/admin/requests")}
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.subscriptions?.active}
            icon={CreditCard}
            onClick={() => navigate("/admin/subscriptions")}
          />
          <StatCard
            label="Active Categories"
            value={stats.taxonomy?.categories?.active}
            icon={Tag}
            onClick={() => navigate("/admin/categories")}
          />
          <StatCard
            label="Active Domains"
            value={stats.taxonomy?.domains?.active}
            icon={Link}
            onClick={() => navigate("/admin/domains")}
          />
        </div>
      )}

      {/* ── Main area: Pending Requests (wide left) + widgets (right) ── */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left — Recent Pending Requests (wider) */}
        <div className="admin-card" style={{ flex: 2, marginBottom: 0 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Recent Pending Requests
          </h2>

          {reqLoading && (
            <p style={{ color: "#6b7280", fontSize: 14 }}>Loading requests...</p>
          )}

          {reqError && <p className="admin-error">{reqError}</p>}

          {!reqLoading && !reqError && requests.length === 0 && (
            <p className="admin-empty">No pending requests.</p>
          )}

          {!reqLoading && !reqError && requests.length > 0 && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Submitted by</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 500 }}>{req.name}</td>
                      <td style={{ color: "#6b7280" }}>{req.owner?.email ?? "—"}</td>
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                        {req.created_at
                          ? new Date(req.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="admin-button-outline"
                          style={{ padding: "4px 12px", fontSize: 13 }}
                          onClick={() => navigate(`/admin/requests?id=${req.id}`)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 14, color: "#2563eb" }}
              onClick={() => navigate("/admin/requests")}
            >
              View All Requests →
            </button>
          </div>
        </div>

        {/* Right — Three stacked data widgets */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Widget A — Recent Users */}
          <DataWidget
            heading="Recent Users"
            loading={recentUsersLoading}
            error={recentUsersError}
            empty={recentUsers.length === 0}
            footerLabel="View All Users →"
            footerPath="/admin/users"
            navigate={navigate}
          >
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.username}</td>
                      <td style={{ color: "#6b7280" }}>{u.email}</td>
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataWidget>

          {/* Widget B — Recent Subscriptions */}
          <DataWidget
            heading="Recent Subscriptions"
            loading={recentSubscriptionsLoading}
            error={recentSubscriptionsError}
            empty={recentSubscriptions.length === 0}
            footerLabel="View All Subscriptions →"
            footerPath="/admin/subscriptions"
            navigate={navigate}
          >
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 500 }}>
                        {sub.user_id ? String(sub.user_id).slice(0, 8) : "—"}
                      </td>
                      <td style={{ color: "#6b7280" }}>{sub.plan_id ?? "—"}</td>
                      <td style={{ color: "#6b7280" }}>{sub.status ?? "—"}</td>
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                        {sub.created_at
                          ? new Date(sub.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataWidget>

          {/* Widget C — Top Websites */}
          <DataWidget
            heading="Top Websites"
            loading={topWebsitesLoading}
            error={topWebsitesError}
            empty={topWebsites.length === 0}
            footerLabel="View All Websites →"
            footerPath="/admin/websites"
            navigate={navigate}
          >
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topWebsites.map((site) => (
                    <tr key={site.id}>
                      <td style={{ fontWeight: 500 }}>{site.name}</td>
                      <td style={{ color: "#6b7280" }}>{site.category ?? "—"}</td>
                      <td style={{ color: "#6b7280" }}>{site.click_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataWidget>

        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
