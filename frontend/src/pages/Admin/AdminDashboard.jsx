import { useEffect, useState } from "react";
import api from "../../api/client";

function AdminDashboard() {
  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalWebsites: 0,
    pendingRequests: 0,
    approvedWebsites: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Recent Users ──────────────────────────────────────────────────────────
  const [recentUsers, setRecentUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  // ── Recent Pending Requests ───────────────────────────────────────────────
  const [pendingReqs, setPendingReqs] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");

  // ── Top Websites ──────────────────────────────────────────────────────────
  const [topWebsites, setTopWebsites] = useState([]);
  const [topLoading, setTopLoading] = useState(true);
  const [topError, setTopError] = useState("");

  // ── Analytics: Total Clicks ───────────────────────────────────────────────
  const [clickData, setClickData] = useState([]);       // { date, clicks }[]
  const [clicksTotal, setClicksTotal] = useState(0);
  const [clicksLoading, setClicksLoading] = useState(false);
  const [clicksError, setClicksError] = useState("");

  // ── Fetch: stats + users + requests + websites ────────────────────────────
  useEffect(() => {
    const loadAll = async () => {
      // Users
      try {
        const { data } = await api.get("/api/v1/users");
        const users = data.items ?? data;
        setRecentUsers(users.slice(0, 8));
        setStats((s) => ({ ...s, totalUsers: users.length }));
      } catch (err) {
        setUsersError(err.response?.data?.detail || "Failed to load users.");
      } finally {
        setUsersLoading(false);
      }

      // Pending requests
      try {
        const { data } = await api.get("/api/v1/admin/requests", {
          params: { page: 1, page_size: 5 },
        });
        const items = Array.isArray(data) ? data : data.items ?? [];
        setPendingReqs(items);
        setStats((s) => ({ ...s, pendingRequests: data.total ?? items.length }));
      } catch (err) {
        setPendingError(err.response?.data?.detail || "Failed to load requests.");
      } finally {
        setPendingLoading(false);
      }

      // All websites (for stats + top websites)
      try {
        const { data } = await api.get("/api/v1/websites/admin/all");
        const sites = data.items ?? data;
        const approved = sites.filter((s) => s.status === "approved").length;
        setStats((s) => ({ ...s, totalWebsites: sites.length, approvedWebsites: approved }));
        const sorted = [...sites].sort(
          (a, b) => (b.total_clicks ?? 0) - (a.total_clicks ?? 0)
        );
        setTopWebsites(sorted.slice(0, 5));
      } catch (err) {
        setTopError(err.response?.data?.detail || "Failed to load websites.");
      } finally {
        setTopLoading(false);
        setStatsLoading(false);
      }
    };

    loadAll();
  }, []);

  // ── Fetch: analytics click data (last 30 days) ────────────────────────────
  useEffect(() => {
    const loadClickData = async () => {
      setClicksLoading(true);
      setClicksError("");
      try {
        const now = new Date();
        const end = now.toISOString().slice(0, 10);
        const startMs = new Date(now);
        startMs.setDate(startMs.getDate() - 29);
        const start = startMs.toISOString().slice(0, 10);

        // Fetch all websites
        const { data: wsData } = await api.get("/api/v1/websites/admin/all");
        const sites = wsData.items ?? wsData;

        // Fetch per-site analytics in parallel
        const perSite = await Promise.all(
          sites.map(async (site) => {
            try {
              const { data } = await api.get(
                `/api/v1/analytics/${site.id}/stats`,
                { params: { start_date: start, end_date: end } }
              );
              return data.data ?? [];
            } catch {
              return [];
            }
          })
        );

        // Aggregate into a date map
        const dateMap = {};
        perSite.forEach((days) => {
          days.forEach(({ date, clicks }) => {
            dateMap[date] = (dateMap[date] ?? 0) + (clicks ?? 0);
          });
        });

        // Build sorted 30-day array, filling missing days with 0
        const result = [];
        for (let i = 0; i < 30; i++) {
          const d = new Date(startMs);
          d.setDate(startMs.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          result.push({ date: key, clicks: dateMap[key] ?? 0 });
        }

        const total = result.reduce((sum, d) => sum + d.clicks, 0);
        setClickData(result);
        setClicksTotal(total);
      } catch (err) {
        setClicksError(err.response?.data?.detail || "Failed to load analytics.");
      } finally {
        setClicksLoading(false);
      }
    };

    loadClickData();
  }, []);

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Dashboard</h1>
      <p className="admin-subtitle">Overview of your platform.</p>

      {/* ── Stats row ── */}
      <div className="admin-stats-grid" style={{ marginBottom: 28 }}>
        <div className="admin-card">
          <div className="admin-card-label">Total Users</div>
          <div className="admin-card-value">
            {statsLoading ? "—" : stats.totalUsers.toLocaleString()}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Total Websites</div>
          <div className="admin-card-value">
            {statsLoading ? "—" : stats.totalWebsites.toLocaleString()}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Approved Websites</div>
          <div className="admin-card-value">
            {statsLoading ? "—" : stats.approvedWebsites.toLocaleString()}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-label">Pending Requests</div>
          <div className="admin-card-value">
            {statsLoading ? "—" : stats.pendingRequests.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Analytics: Total Clicks ── */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
            Total Clicks — Last 30 Days
          </h2>
          {!clicksLoading && !clicksError && (
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              Total: <strong>{clicksTotal.toLocaleString()}</strong>
            </span>
          )}
        </div>

        {clicksLoading && (
          <p style={{ color: "#6b7280" }}>Loading click data…</p>
        )}
        {clicksError && <p className="admin-error">{clicksError}</p>}
        {!clicksLoading &&
          !clicksError &&
          (clickData.every((d) => d.clicks === 0) ? (
            <p className="admin-empty">No click data for the last 30 days.</p>
          ) : (
            (() => {
              const W = 900,
                H = 240,
                padL = 48,
                padR = 16,
                padT = 16,
                padB = 48;
              const innerW = W - padL - padR;
              const innerH = H - padT - padB;
              const maxClicks = Math.max(
                ...clickData.map((d) => d.clicks),
                1
              );
              const barW = Math.max(innerW / clickData.length - 2, 2);
              const yTicks = 4;
              return (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  width="100%"
                  style={{ display: "block", overflow: "visible" }}
                >
                  {/* Y gridlines + labels */}
                  {Array.from({ length: yTicks + 1 }, (_, i) => {
                    const val = Math.round((maxClicks / yTicks) * i);
                    const y = padT + innerH - (i / yTicks) * innerH;
                    return (
                      <g key={i}>
                        <line
                          x1={padL}
                          x2={W - padR}
                          y1={y}
                          y2={y}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 6}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="#9ca3af"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}
                  {/* Bars */}
                  {clickData.map((d, i) => {
                    const barH = (d.clicks / maxClicks) * innerH;
                    const x =
                      padL + i * (innerW / clickData.length) + 1;
                    const y = padT + innerH - barH;
                    const showLabel = i % 5 === 0;
                    return (
                      <g key={d.date}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(barH, 1)}
                          fill="#2563eb"
                          rx="2"
                        >
                          <title>
                            {d.date}: {d.clicks} click
                            {d.clicks !== 1 ? "s" : ""}
                          </title>
                        </rect>
                        {showLabel && (
                          <text
                            x={x + barW / 2}
                            y={H - padB + 14}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#6b7280"
                            transform={`rotate(-35, ${x + barW / 2}, ${
                              H - padB + 14
                            })`}
                          >
                            {d.date.slice(5)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {/* X axis line */}
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={padT + innerH}
                    y2={padT + innerH}
                    stroke="#d1d5db"
                    strokeWidth="1"
                  />
                  {/* Y axis line */}
                  <line
                    x1={padL}
                    x2={padL}
                    y1={padT}
                    y2={padT + innerH}
                    stroke="#d1d5db"
                    strokeWidth="1"
                  />
                </svg>
              );
            })()
          ))}
      </div>

      {/* ── Recent Users (full width) ── */}
      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
          Recent Users
        </h2>

        {usersLoading && (
          <p style={{ color: "#6b7280" }}>Loading users…</p>
        )}
        {usersError && <p className="admin-error">{usersError}</p>}
        {!usersLoading && !usersError && recentUsers.length === 0 && (
          <p className="admin-empty">No users found.</p>
        )}
        {!usersLoading && !usersError && recentUsers.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Admin</th>
                  <th>Active</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.full_name || (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          u.is_admin
                            ? "admin-badge-admin"
                            : "admin-badge-user"
                        }`}
                      >
                        {u.is_admin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${
                          u.is_active
                            ? "admin-badge-approved"
                            : "admin-badge-rejected"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom grid: Pending Requests | Top Websites ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {/* Pending Requests */}
        <div className="admin-card">
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
            Recent Pending Requests
          </h2>

          {pendingLoading && (
            <p style={{ color: "#6b7280" }}>Loading…</p>
          )}
          {pendingError && <p className="admin-error">{pendingError}</p>}
          {!pendingLoading && !pendingError && pendingReqs.length === 0 && (
            <p className="admin-empty">No pending requests.</p>
          )}
          {!pendingLoading && !pendingError && pendingReqs.length > 0 && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Owner</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReqs.map((site) => (
                    <tr key={site.id}>
                      <td>{site.name}</td>
                      <td>{site.owner?.email ?? "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(site.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Websites */}
        <div className="admin-card">
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 600 }}>
            Top Websites by Clicks
          </h2>

          {topLoading && (
            <p style={{ color: "#6b7280" }}>Loading…</p>
          )}
          {topError && <p className="admin-error">{topError}</p>}
          {!topLoading && !topError && topWebsites.length === 0 && (
            <p className="admin-empty">No websites found.</p>
          )}
          {!topLoading && !topError && topWebsites.length > 0 && (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topWebsites.map((site) => (
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
                        <span
                          className={
                            site.status === "approved"
                              ? "admin-badge admin-badge-approved"
                              : site.status === "rejected"
                              ? "admin-badge admin-badge-rejected"
                              : "admin-badge admin-badge-pending"
                          }
                        >
                          {site.status}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {(site.total_clicks ?? 0).toLocaleString()}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
