import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Globe, CheckCircle, Clock, XCircle, Star, CreditCard, ArrowRight,
} from "lucide-react";
import api from "../../api/client";

/* ── Data fetcher ─────────────────────────────────────────────────────────── */
async function fetchDashboardStats() {
  const { data } = await api.get("/api/v1/admin/dashboard");
  return data;
}

/* ── Sub-components ───────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, iconColor = "#6b7280", onClick }) {
  return (
    <div
      className="admin-stat-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p className="admin-stat-label">{label}</p>
        {Icon && <Icon size={16} color={iconColor} />}
      </div>
      <p className="admin-stat-value">{value ?? <span style={{ opacity: 0.3 }}>—</span>}</p>
      {onClick && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9ca3af" }}>
          <span>View</span>
          <ArrowRight size={11} />
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="admin-stat-card">
      <div className="skeleton" style={{ height: 11, width: "55%", marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 26, width: "40%" }} />
    </div>
  );
}

function SectionLabel({ children }) {
  return <h2 className="admin-section-title">{children}</h2>;
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn:  fetchDashboardStats,
    staleTime: 60_000,       // re-use cached data for 1 min
    retry: 1,
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-subtitle">Platform overview at a glance.</p>
        </div>
      </div>

      {isError && (
        <p className="admin-error" style={{ marginBottom: 16 }}>
          Failed to load dashboard stats.
        </p>
      )}

      {isLoading ? (
        <>
          <SectionLabel>Websites</SectionLabel>
          <div className="admin-stat-grid" style={{ marginBottom: 28 }}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SectionLabel>Subscriptions</SectionLabel>
          <div className="admin-stat-grid">
            <SkeletonCard />
          </div>
        </>
      ) : stats && (
        <>
          <SectionLabel>Websites</SectionLabel>
          <div className="admin-stat-grid" style={{ marginBottom: 28 }}>
            <StatCard
              label="Total"
              value={stats.websites.total}
              icon={Globe}
              iconColor="#6366f1"
              onClick={() => navigate("/admin/websites")}
            />
            <StatCard
              label="Approved"
              value={stats.websites.approved}
              icon={CheckCircle}
              iconColor="#12b76a"
              onClick={() => navigate("/admin/websites?status=approved")}
            />
            <StatCard
              label="Pending"
              value={stats.websites.pending}
              icon={Clock}
              iconColor="#f59e0b"
              onClick={() => navigate("/admin/websites?status=pending")}
            />
            <StatCard
              label="Rejected"
              value={stats.websites.rejected}
              icon={XCircle}
              iconColor="#f04438"
              onClick={() => navigate("/admin/websites?status=rejected")}
            />
            <StatCard
              label="Premiered"
              value={stats.websites.premiered}
              icon={Star}
              iconColor="#f59e0b"
              onClick={() => navigate("/admin/websites?premiered=true")}
            />
          </div>

          <SectionLabel>Subscriptions</SectionLabel>
          <div className="admin-stat-grid">
            <StatCard
              label="Active subscriptions"
              value={stats.subscriptions.active}
              icon={CreditCard}
              iconColor="#6366f1"
              onClick={() => navigate("/admin/subscriptions")}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
