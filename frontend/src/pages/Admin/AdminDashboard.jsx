import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Globe,
  ClipboardList,
  CreditCard,
  BarChart2,
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
        <span
          style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}
        >
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
        // Handle both array response and paginated { items: [] } shape
        const items = Array.isArray(data) ? data : data.items ?? [];
        setRequests(items);
      })
      .catch(() => setReqError("Failed to load pending requests."))
      .finally(() => setReqLoading(false));
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

      {/* ── Two-column main area ───────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left — Recent Pending Requests */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
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

        {/* Right — Quick Actions */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Quick Actions
          </h2>

          {[
            { label: "Users", icon: Users, path: "/admin/users" },
            { label: "Websites", icon: Globe, path: "/admin/websites" },
            { label: "Review Requests", icon: ClipboardList, path: "/admin/requests" },
            { label: "Subscriptions", icon: CreditCard, path: "/admin/subscriptions" },
            { label: "Analytics", icon: BarChart2, path: "/admin/analytics" },
            { label: "Categories", icon: Tag, path: "/admin/categories" },
            { label: "Domains", icon: Link, path: "/admin/domains" },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              className="admin-button-outline"
              onClick={() => navigate(path)}
              style={{
                width: "100%",
                textAlign: "left",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
