import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import "../../styles/analytics.css";

// ── helpers ───────────────────────────────────────────────────────────────────

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { start: toISODate(start), end: toISODate(end) };
}

// Tiny bar chart — pure CSS, no library needed
function BarChart({ data }) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.clicks), 1);

  return (
    <div className="analytics-chart" role="img" aria-label="Click activity chart">
      {data.map((point) => (
        <div key={point.date} className="analytics-bar-wrapper">
          <div
            className="analytics-bar"
            style={{ height: `${(point.clicks / max) * 100}%` }}
            title={`${point.date}: ${point.clicks} click${point.clicks !== 1 ? "s" : ""}`}
          />
        </div>
      ))}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

function Analytics() {
  const { websiteId } = useParams();

  const range = defaultRange();
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);

  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [selectedId, setSelectedId] = useState(websiteId || "");

  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statsError, setStatsError] = useState("");

  // Load owner's listings so they can switch between them
  useEffect(() => {
    const loadListings = async () => {
      try {
        const { data } = await api.get("/api/v1/websites/my");
        const approvedListings = (data.items || []).filter(
          (l) => l.status === "approved"
        );
        setListings(approvedListings);

        // Auto-select: param → first approved listing
        if (!selectedId && approvedListings.length > 0) {
          setSelectedId(approvedListings[0].id);
        }
      } catch {
        // Non-fatal — user sees the empty state
      } finally {
        setIsLoadingListings(false);
      }
    };

    loadListings();
  }, []);

  // Load stats whenever selection or date range changes
  useEffect(() => {
    if (!selectedId) return;

    const loadStats = async () => {
      setIsLoadingStats(true);
      setStatsError("");

      try {
        const { data } = await api.get(
          `/api/v1/analytics/${selectedId}/stats`,
          { params: { start_date: startDate, end_date: endDate } }
        );
        setStats(data);
      } catch (err) {
        setStatsError(
          err.response?.data?.detail ||
            "We couldn't load analytics for this listing."
        );
        setStats(null);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [selectedId, startDate, endDate]);

  const handleExport = async () => {
    if (!selectedId) return;

    setIsExporting(true);

    try {
      const response = await api.get(
        `/api/v1/analytics/${selectedId}/export`,
        { responseType: "blob" }
      );

      // Trigger browser download
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `clicks_${selectedId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("We couldn't export the data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const selectedListing = listings.find((l) => l.id === selectedId);

  return (
    <main className="analytics-page">
      <div className="analytics-container">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="analytics-header">
          <div>
            <Link to="/dashboard" className="analytics-back-link">
              ← Back to dashboard
            </Link>
            <h1>Analytics</h1>
            <p>Click activity for your approved listings.</p>
          </div>

          <button
            type="button"
            className="analytics-export-button"
            onClick={handleExport}
            disabled={!selectedId || isExporting}
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <div className="analytics-controls">
          <div className="analytics-control-group">
            <label htmlFor="listing-select">Listing</label>
            <select
              id="listing-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={isLoadingListings}
            >
              {isLoadingListings && (
                <option value="">Loading listings...</option>
              )}
              {!isLoadingListings && listings.length === 0 && (
                <option value="">No approved listings</option>
              )}
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.name}
                </option>
              ))}
            </select>
          </div>

          <div className="analytics-control-group">
            <label htmlFor="start-date">From</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="analytics-control-group">
            <label htmlFor="end-date">To</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={toISODate(new Date())}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* ── No approved listings ──────────────────────────────────────── */}
        {!isLoadingListings && listings.length === 0 && (
          <div className="analytics-empty">
            <h3>No approved listings</h3>
            <p>
              Analytics are available once your listing is approved by an admin.
            </p>
            <Link to="/dashboard" className="analytics-back-link">
              Go to dashboard
            </Link>
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────────────────── */}
        {selectedId && (
          <>
            {isLoadingStats && (
              <div className="analytics-loading">
                <p>Loading analytics...</p>
              </div>
            )}

            {!isLoadingStats && statsError && (
              <div className="analytics-error" role="alert">
                {statsError}
              </div>
            )}

            {!isLoadingStats && !statsError && stats && (
              <>
                {/* Total */}
                <div className="analytics-total-card">
                  <div>
                    <span>Total clicks</span>
                    <strong>{stats.total_clicks.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span>Listing</span>
                    <strong>{stats.website_name}</strong>
                  </div>
                  <div>
                    <span>Period</span>
                    <strong>
                      {startDate} → {endDate}
                    </strong>
                  </div>
                </div>

                {/* Chart */}
                <div className="analytics-chart-card">
                  <h2>Daily clicks</h2>

                  {stats.total_clicks === 0 ? (
                    <p className="analytics-no-data">
                      No clicks recorded in this period.
                    </p>
                  ) : (
                    <BarChart data={stats.data} />
                  )}
                </div>

                {/* Data table */}
                {stats.total_clicks > 0 && (
                  <div className="analytics-table-card">
                    <h2>Click breakdown</h2>

                    <div className="analytics-table-wrapper">
                      <table className="analytics-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Clicks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...stats.data]
                            .filter((d) => d.clicks > 0)
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((point) => (
                              <tr key={point.date}>
                                <td>{point.date}</td>
                                <td>{point.clicks}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default Analytics;
