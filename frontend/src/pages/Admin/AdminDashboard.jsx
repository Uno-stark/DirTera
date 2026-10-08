import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

function StatCard({ label, value, muted, onClick }) {
  return (
    <div
      className="admin-card"
      onClick={onClick}
      style={{
        marginBottom: 0,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          fontSize: 28,
          color: muted ? "#6b7280" : "#111827",
        }}
      >
        {value ?? "—"}
      </strong>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: 16,
          color: "#374151",
          fontWeight: 600,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/v1/admin/dashboard")
      .then(({ data }) => {
        setStats(data);
      })
      .catch(() => {
        setError("Failed to load dashboard stats.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Admin Dashboard</h1>

      <p className="admin-subtitle">
        Platform-wide overview.
      </p>

      {loading && <p>Loading dashboard...</p>}

      {error && (
        <p className="admin-error">
          {error}
        </p>
      )}

      {stats && (
        <>
          {/* Users */}
          <Section title="Users">
            <StatCard
              label="Total users"
              value={stats.users.total}
              onClick={() => navigate("/admin/users")}
            />

            
          </Section>

          {/* Websites */}
          <Section title="Websites">
            <StatCard
              label="Total"
              value={stats.websites.total}
              onClick={() => navigate("/admin/websites")}
            />

            <StatCard
              label="Approved"
              value={stats.websites.approved}
              onClick={() =>
                navigate("/admin/websites?status=approved")
              }
            />

            <StatCard
              label="Pending"
              value={stats.websites.pending}
              onClick={() =>
                navigate("/admin/websites?status=pending")
              }
            />

            <StatCard
              label="Rejected"
              value={stats.websites.rejected}
              muted
              onClick={() =>
                navigate("/admin/websites?status=rejected")
              }
            />

           <StatCard
 
  label="Premiered"
  value={stats.websites.premiered}
  onClick={() => navigate("/admin/websites?premiered=true")}
/>
          </Section>

          {/* Subscriptions */}
          <Section title="Subscriptions">
            <StatCard
              label="Active"
              value={stats.subscriptions.active}
              onClick={() => navigate("/admin/subscriptions")}
            />
          </Section>

          {/* Taxonomy */}
          <Section title="Taxonomy">
            <StatCard
              label="Total categories"
              value={stats.taxonomy.categories.total}
              onClick={() => navigate("/admin/categories")}
            />

            <StatCard
              label="Active categories"
              value={stats.taxonomy.categories.active}
              onClick={() => navigate("/admin/categories")}
            />

            <StatCard
              label="Total domains"
              value={stats.taxonomy.domains.total}
              onClick={() => navigate("/admin/domains")}
            />

            <StatCard
              label="Active domains"
              value={stats.taxonomy.domains.active}
              onClick={() => navigate("/admin/domains")}
            />
          </Section>

          {/* Analytics */}
          <Section title="Analytics">
            <StatCard
              label="Website analytics"
              value="View"
              onClick={() => navigate("/admin/analytics")}
            />
          </Section>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
