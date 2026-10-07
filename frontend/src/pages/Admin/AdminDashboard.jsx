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

function StatCard({ label, value, icon: Icon, highlight, onClick }) {
  return (
    <div
      className="admin-card"
      onClick={onClick}
      style={{
        marginBottom: 0,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: highlight ? "3px solid #d97706" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>{label}</span>
        {Icon && <Icon size={18} style={{ color: highlight ? "#d97706" : "#9ca3af" }} />}
      </div>
      <strong style={{ fontSize: 28, color: highlight ? "#d97706" : "#111827", lineHeight: 1 }}>
        {value ?? "—"}
      </strong>
    </div>
  );
}

function ClickBarChart({ data }) {
  const W = 900, H = 240, padL = 48, padR = 16, padT = 16, padB = 48;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxClicks = Math.max(...data.map((d) => d.clicks), 1);
  const barW = Math.max(innerW / data.length - 2, 2);
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = Math.round((maxClicks / yTicks) * i);
        const y = padT + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{val}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = Math.max((d.clicks / maxClicks) * innerH, 1);
        const x = padL + i * (innerW / data.length) + 1;
        const y = padT + innerH - (d.clicks > 0 ? (d.clicks / maxClicks) * innerH : 0);
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={d.clicks > 0 ? "#2563eb" : "#e5e7eb"} rx="2">
              <title>{d.date}: {d.clicks} click{d.clicks !== 1 ? "s" : ""}</title>
            </rect>
            {i % 5 === 0 && (
              <text
                x={x + barW / 2} y={H - padB + 14}
                textAnchor="middle" fontSize="10" fill="#6b7280"
                transform={`rotate(-35, ${x + barW / 2}, ${H - padB + 14})`}
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#d1d5db" strokeWidth="1" />
      <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="#d1d5db" strokeWidth="1" />
    </svg>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const [recentUsers, setRecentUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [pendingReqs, setPendingReqs] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");

  const [topWebsites, setTopWebsites] = useState([]);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState("");

  const [clickData, setClickData] = useState([]);
  const [clicksTotal, setClicksTotal] = useState(0);
  const [clicksLoading, setClicksLoading] = useState(true);
  const [clicksError, setClicksError] = useState("");

  const defaultEnd = new Date().toISOString().slice(0, 10);
  const defaultStart = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const [filterStart, setFilterStart] = useState(defaultStart);
  const [filterEnd, setFilterEnd] = useState(defaultEnd);

  useEffect(() => {
    api.get("/api/v1/admin/dashboard")
      .then(({ data }) => setStats(data))
      .catch(() => setStatsError("Failed to load stats."))
      .finally(() => setStatsLoading(false));

    api.get("/api/v1/users", { params: { page: 1, page_size: 5 } })
      .then(({ data }) => setRecentUsers(Array.isArray(data) ? data : data.items ?? []))
      .catch(() => setUsersError("Failed to load users."))
      .finally(() => setUsersLoading(false));

    api.get("/api/v1/admin/requests", { params: { page: 1, page_size: 5 } })
      .then(({ data }) => setPendingReqs(Array.isArray(data) ? data : data.items ?? []))
      .catch(() => setPendingError("Failed to load requests."))
      .finally(() => setPendingLoading(false));

    api.get("/api/v1/websites/admin/all")
      .then(({ data }) => {
        const sites = Array.isArray(data) ? data : data.items ?? [];
        const sorted = [...sites].sort((a, b) => (b.total_clicks ?? 0) - (a.total_clicks ?? 0));
        setTopWebsites(sorted.slice(0, 5));
      })
      .catch(() => setTopError("Failed to load websites."))
      .finally(() => setTopLoading(false));
  }, []);

  useEffect(() => {
    const load = async () => {
      setClicksLoading(true);
      setClicksError("");
      try {
        const start = filterStart;
        const end = filterEnd;
        const startD = new Date(start);

        const { data: wsData } = await api.get("/api/v1/websites/admin/all");
        const sites = Array.isArray(wsData) ? wsData : wsData.items ?? [];

        const perSite = await Promise.all(
          sites.map(async (site) => {
            try {
              const { data } = await api.get(`/api/v1/analytics/${site.id}/stats`, {
                params: { end_date: end },
              });
              return data.data ?? [];
            } catch {
              return [];
            }
          })
        );

        const dateMap = {};
        perSite.forEach((days) =>
          days.forEach(({ date, clicks }) => {
            if (date >= start && date <= end)
              dateMap[date] = (dateMap[date] ?? 0) + (clicks ?? 0);
          })
        );

        // Build array for every day in the selected range
        const result = [];
        const endD = new Date(end);
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          const key = d.toISOString().slice(0, 10);
          result.push({ date: key, clicks: dateMap[key] ?? 0 });
        }

        setClickData(result);
        setClicksTotal(result.reduce((s, d) => s + d.clicks, 0));
      } catch {
        setClicksError("Failed to load click analytics.");
      } finally {
        setClicksLoading(false);
      }
    };
    load();
  }, [filterStart, filterEnd]);

  return (
    <>
      {/* Sticky stats header */}
      <div className="admin-sticky-header">
        <h1 className="admin-page-title">Admin Dashboard</h1>
        {statsError && <p className="admin-error">{statsError}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12 }}>
          <StatCard label="Total Users" value={statsLoading ? "…" : stats?.users?.total} icon={Users} onClick={() => navigate("/admin/users")} />
          <StatCard label="Total Websites" value={statsLoading ? "…" : stats?.websites?.total} icon={Globe} onClick={() => navigate("/admin/websites")} />
          <StatCard label="Approved" value={statsLoading ? "…" : stats?.websites?.approved} icon={Globe} onClick={() => navigate("/admin/websites")} />
          <StatCard label="Pending" value={statsLoading ? "…" : stats?.websites?.pending} icon={ClipboardList} highlight={(stats?.websites?.pending ?? 0) > 0} onClick={() => navigate("/admin/requests")} />
          <StatCard label="Subscriptions" value={statsLoading ? "…" : stats?.subscriptions?.active} icon={CreditCard} onClick={() => navigate("/admin/subscriptions")} />
          <StatCard label="Categories" value={statsLoading ? "…" : stats?.taxonomy?.categories?.active} icon={Tag} onClick={() => navigate("/admin/categories")} />
          <StatCard label="Domains" value={statsLoading ? "…" : stats?.taxonomy?.domains?.active} icon={Link} onClick={() => navigate("/admin/domains")} />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="admin-page">

        {/* Clicks chart */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Total Clicks</h2>
            {!clicksLoading && !clicksError && (
              <span style={{ fontSize: 13, color: "#6b7280" }}>Total: <strong>{clicksTotal.toLocaleString()}</strong></span>
            )}
          </div>
          {/* Date filter */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 17, color: "#6b7280", marginBottom: 6 }}>From</label>
              <input type="date" className="admin-input" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 17, color: "#6b7280", marginBottom: 6 }}>To</label>
              <input type="date" className="admin-input" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
            </div>
            <button
              className="admin-button-outline"
              onClick={() => { setFilterStart(defaultStart); setFilterEnd(defaultEnd); }}
            >
              Reset
            </button>
          </div>
          {clicksLoading && <p style={{ color: "#6b7280", fontSize: 14 }}>Loading chart…</p>}
          {clicksError && <p className="admin-error">{clicksError}</p>}
          {!clicksLoading && !clicksError && <ClickBarChart data={clickData} />}
        </div>

        {/* Recent Users */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Recent Users</h2>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#2563eb", padding: 0 }} onClick={() => navigate("/admin/users")}>View All →</button>
          </div>
          {usersLoading && <p style={{ color: "#6b7280", fontSize: 14 }}>Loading…</p>}
          {usersError && <p className="admin-error">{usersError}</p>}
          {!usersLoading && !usersError && recentUsers.length === 0 && <p className="admin-empty">No users found.</p>}
          {!usersLoading && !usersError && recentUsers.length > 0 && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
                </thead>
                <tbody>
                  {recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.full_name || "—"}</td>
                      <td style={{ color: "#6b7280" }}>{u.email}</td>
                      <td><span className={`admin-badge ${u.is_admin ? "admin-badge-admin" : "admin-badge-user"}`}>{u.is_admin ? "Admin" : "User"}</span></td>
                      <td><span className={`admin-badge ${u.is_active ? "admin-badge-approved" : "admin-badge-rejected"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom grid: Pending | Top Websites */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Recent Pending Requests</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#2563eb", padding: 0 }} onClick={() => navigate("/admin/requests")}>View All →</button>
            </div>
            {pendingLoading && <p style={{ color: "#6b7280", fontSize: 14 }}>Loading…</p>}
            {pendingError && <p className="admin-error">{pendingError}</p>}
            {!pendingLoading && !pendingError && pendingReqs.length === 0 && <p className="admin-empty">No pending requests.</p>}
            {!pendingLoading && !pendingError && pendingReqs.length > 0 && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Owner</th><th>Submitted</th><th>Action</th></tr></thead>
                  <tbody>
                    {pendingReqs.map((site) => (
                      <tr key={site.id}>
                        <td style={{ fontWeight: 500 }}>{site.name}</td>
                        <td style={{ color: "#6b7280" }}>{site.owner?.email ?? "—"}</td>
                        <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{site.created_at ? new Date(site.created_at).toLocaleDateString() : "—"}</td>
                        <td><button className="admin-button-outline" style={{ padding: "4px 12px", fontSize: 13 }} onClick={() => navigate(`/admin/requests?id=${site.id}`)}>Review</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Top Websites</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#2563eb", padding: 0 }} onClick={() => navigate("/admin/websites")}>View All →</button>
            </div>
            {topLoading && <p style={{ color: "#6b7280", fontSize: 14 }}>Loading…</p>}
            {topError && <p className="admin-error">{topError}</p>}
            {!topLoading && !topError && topWebsites.length === 0 && <p className="admin-empty">No websites found.</p>}
            {!topLoading && !topError && topWebsites.length > 0 && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Status</th><th>Clicks</th></tr></thead>
                  <tbody>
                    {topWebsites.map((site) => (
                      <tr key={site.id}>
                        <td style={{ fontWeight: 500 }}>{site.name}</td>
                        <td><span className={site.status === "approved" ? "admin-badge admin-badge-approved" : site.status === "rejected" ? "admin-badge admin-badge-rejected" : "admin-badge admin-badge-pending"}>{site.status}</span></td>
                        <td style={{ color: "#6b7280" }}><strong>{(site.total_clicks ?? 0).toLocaleString()}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

export default AdminDashboard;
