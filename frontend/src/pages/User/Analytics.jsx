import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, TrendingUp, MousePointer, Users, Calendar } from "lucide-react";
import api from "../../api/client";
import { fetchMyListings, keys } from "../../api/queries";
import "../../styles/analytics.css";

/* ── Fetch analytics summary ─────────────────────────────────────────────── */
async function fetchAnalyticsSummary(websiteId) {
  const { data } = await api.get(`/api/v1/analytics/${websiteId}/summary`);
  return data;
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, isLoading }) {
  return (
    <div className="an-stat-card">
      <div className="an-stat-icon">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="an-stat-content">
        <span className="an-stat-label">{label}</span>
        {isLoading ? (
          <div className="skeleton" style={{ height: 28, width: 60 }} />
        ) : (
          <strong className="an-stat-value">{value.toLocaleString()}</strong>
        )}
      </div>
    </div>
  );
}

function Analytics() {
  const { websiteId } = useParams();

  const { data: listingsData, isLoading } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 2 * 60_000,
  });

  const listings = (listingsData?.items ?? []).filter((l) => l.status === "approved");

  // Pre-select listing from URL param, or default to first
  const [selectedId, setSelectedId] = useState(
    websiteId && listings.some((l) => l.id === websiteId) ? websiteId : ""
  );

  // Resolve selectedId once listings load
  const resolvedId = selectedId || listings[0]?.id || "";

  // Update selectedId when listings load
  useEffect(() => {
    if (!selectedId && listings.length > 0) {
      setSelectedId(listings[0].id);
    }
  }, [listings, selectedId]);

  // Fetch analytics summary
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["analytics", "summary", resolvedId],
    queryFn: () => fetchAnalyticsSummary(resolvedId),
    enabled: Boolean(resolvedId),
    staleTime: 60_000,
  });

  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    if (!resolvedId) return;
    setExporting(true);
    setExportError("");
    try {
      const res = await api.get(`/api/v1/analytics/${resolvedId}/export`, {
        responseType: "blob",
      });
      const url  = URL.createObjectURL(new Blob([res.data]));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `clicks_${resolvedId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="an-page">
      <div className="an-container">

        <div className="an-header">
          <Link to="/dashboard" className="an-back">
            <ArrowLeft size={14} strokeWidth={2.5} /> Back to dashboard
          </Link>
          <h1>Analytics</h1>
          <p>View click statistics and export data for your listings.</p>
        </div>

        {isLoading && <div className="an-state">Loading listings…</div>}

        {!isLoading && listings.length === 0 && (
          <div className="an-empty">
            <p>No approved listings. Exports are available once a listing is approved.</p>
          </div>
        )}

        {!isLoading && listings.length > 0 && (
          <>
            {/* Listing selector */}
            <div className="an-selector-card">
              <label htmlFor="an-listing" className="an-selector-label">
                Select listing
              </label>
              <select
                id="an-listing"
                className="an-select"
                value={resolvedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Summary stats */}
            {resolvedId && (
              <div className="an-stats-section">
                <h2 className="an-section-title">Overview</h2>
                <div className="an-stats-grid">
                  <StatCard
                    icon={MousePointer}
                    label="Total Clicks"
                    value={summary?.total_clicks ?? 0}
                    isLoading={isLoadingSummary}
                  />
                  <StatCard
                    icon={Users}
                    label="Unique Visitors"
                    value={summary?.unique_ips ?? 0}
                    isLoading={isLoadingSummary}
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Avg. Daily Clicks"
                    value={summary?.avg_clicks_per_day ?? 0}
                    isLoading={isLoadingSummary}
                  />
                  <StatCard
                    icon={Calendar}
                    label="Days Tracked"
                    value={summary?.days_tracked ?? 0}
                    isLoading={isLoadingSummary}
                  />
                </div>
                {summary?.first_click_date && (
                  <p className="an-date-range">
                    Data from{" "}
                    <strong>
                      {new Date(summary.first_click_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                    {summary.last_click_date && (
                      <>
                        {" "}to{" "}
                        <strong>
                          {new Date(summary.last_click_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Export section */}
            <div className="an-export-section">
              <h2 className="an-section-title">Export Data</h2>
              <div className="an-export-card">
                <p className="an-export-desc">
                  Download detailed click event data as CSV for further analysis.
                </p>

                {exportError && (
                  <p className="an-state an-state--error" role="alert">{exportError}</p>
                )}

                <button
                  type="button"
                  className="an-export-btn"
                  onClick={handleExport}
                  disabled={exporting || !resolvedId}
                >
                  <Download size={14} strokeWidth={2.5} />
                  {exporting ? "Exporting…" : "Download CSV"}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

export default Analytics;
