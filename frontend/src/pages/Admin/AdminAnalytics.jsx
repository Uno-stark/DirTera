import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminAll, fetchBulkStats, keys } from "../../api/queries";

const MAX_WEBSITES = 100;

function AdminAnalytics() {
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");

  // ── 1. Fetch website list ─────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: keys.adminAll({ page: 1, page_size: MAX_WEBSITES }),
    queryFn:  () => fetchAdminAll({ page: 1, page_size: MAX_WEBSITES }),
    staleTime: 60_000,
  });

  const websites = data?.items ?? [];

  // ── 2. Fetch all click totals in ONE request ──────────────────────────────
  const websiteIds = websites.map((s) => s.id);

  const {
    data:      statsMap,
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: keys.analyticsBulk({ websiteIds, startDate, endDate }),
    queryFn:  () => fetchBulkStats({ websiteIds, startDate, endDate }),
    // Only run once the website list is ready and non-empty
    enabled:  websiteIds.length > 0,
    staleTime: 5 * 60_000,
    // Don't hammer the server on transient errors
    retry: 1,
  });

  const resetDates = () => { setStartDate(""); setEndDate(""); };

  const statusBadgeClass = (s) =>
    s === "approved" ? "admin-badge admin-badge-approved" :
    s === "rejected" ? "admin-badge admin-badge-rejected" :
    "admin-badge admin-badge-pending";

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Analytics</h1>
      <p className="admin-subtitle">Website traffic and click statistics.</p>

      {isLoading && <p style={{ color: "#6b7280" }}>Loading analytics…</p>}
      {isError   && <p className="admin-error">Failed to load website analytics.</p>}

      {!isLoading && !isError && (
        <>
          {/* ── Date filter ─────────────────────────────────────────── */}
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, width: "100%" }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280" }}>
                  Start date
                </label>
                <input type="date" className="admin-input" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "#6b7280" }}>
                  End date
                </label>
                <input type="date" className="admin-input" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button type="button" className="admin-button-outline" onClick={resetDates}>
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* ── Websites table ──────────────────────────────────────── */}
          <div className="admin-card">
            <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>Websites</h2>
            {websites.length === 0 ? (
              <p className="admin-empty">No websites found.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Website</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {websites.map((site) => (
                      <tr key={site.id}>
                        <td>
                          <a href={site.url} target="_blank" rel="noreferrer" className="admin-link">
                            {site.name}
                          </a>
                        </td>
                        <td>{site.owner?.email ?? "—"}</td>
                        <td>
                          <span className={statusBadgeClass(site.status)}>
                            {site.status}
                          </span>
                        </td>
                        <td>
                          {isLoadingStats
                            ? <span style={{ color: "#9ca3af" }}>…</span>
                            : <strong>{(statsMap?.[site.id] ?? 0).toLocaleString()}</strong>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminAnalytics;
