import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

function StatCard({ label, value, muted }) {
  return (
    <div className="admin-card" style={{ marginBottom: 0 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6b7280" }}>{label}</p>
      <strong style={{ fontSize: 28, color: muted ? "#6b7280" : "#111827" }}>{value ?? "—"}</strong>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, color: "#374151", fontWeight: 600 }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/v1/admin/dashboard")
      .then(({ data }) => setStats(data))
      .catch(() => setError("Failed to load dashboard stats."));
  }, []);

  return (
    <div className="admin-page">
      <button type="button" onClick={() => navigate("/")} style={{ marginBottom: 16, background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 14, color: "#374151" }}>
        ← Browse
      </button>
      <h1 className="admin-page-title">Admin Dashboard</h1>
      <p className="admin-subtitle">Platform-wide overview.</p>

      {error && <p className="admin-error">{error}</p>}

      {stats && (
        <>
          <Section title="Users">
            <StatCard label="Total users" value={stats.users.total} />
            <StatCard label="Active users" value={stats.users.active} />
          </Section>

          <Section title="Websites">
            <StatCard label="Total" value={stats.websites.total} />
            <StatCard label="Approved" value={stats.websites.approved} />
            <StatCard label="Pending" value={stats.websites.pending} />
            <StatCard label="Rejected" value={stats.websites.rejected} muted />
            <StatCard label="Premiered" value={stats.websites.premiered} />
          </Section>

          <Section title="Subscriptions">
            <StatCard label="Active" value={stats.subscriptions.active} />
          </Section>

          <Section title="Taxonomy">
            <StatCard label="Total categories" value={stats.taxonomy.categories.total} />
            <StatCard label="Active categories" value={stats.taxonomy.categories.active} />
            <StatCard label="Total domains" value={stats.taxonomy.domains.total} />
            <StatCard label="Active domains" value={stats.taxonomy.domains.active} />
          </Section>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
