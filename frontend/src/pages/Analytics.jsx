import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import "../styles/analytics.css";

const fmt = (n) => (n ?? 0).toLocaleString();

function StatCard({ label, value }) {
  return (
    <div className="an-stat-card">
      <span>{label}</span>
      <strong>{fmt(value)}</strong>
    </div>
  );
}

function BarChart({ data }) {
  if (!data || data.length === 0) return <p className="an-empty">No click data for this period.</p>;

  const max = Math.max(...data.map((d) => d.clicks), 1);

  return (
    <div className="an-chart" role="img" aria-label="Daily click chart">
      {data.map((d) => (
        <div key={d.date} className="an-bar-col" title={`${d.date}: ${d.clicks} clicks`}>
          <div
            className="an-bar"
            style={{ height: `${Math.round((d.clicks / max) * 100)}%` }}
          />
          <span className="an-bar-label">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const { websiteId } = useParams();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState("");

  // Load summary once
  useEffect(() => {
    api
      .get(`/api/v1/analytics/${websiteId}/summary`)
      .then(({ data }) => setSummary(data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load summary."))
      .finally(() => setLoading(false));
  }, [websiteId]);

  // Load daily stats (re-runs when date range changes)
  const loadStats = useCallback(() => {
    setStatsLoading(true);
    api
      .get(`/api/v1/analytics/${websiteId}/stats`, {
        params: { start_date: startDate, end_date: endDate },
      })
      .then(({ data }) => setStats(data))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load stats."))
      .finally(() => setStatsLoading(false));
  }, [websiteId, startDate, endDate]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleExport = () => {
    window.open(
      `${api.defaults.baseURL}/api/v1/analytics/${websiteId}/export`,
      "_blank"
    );
  };

  return (
    <main className="an-page">
      <header className="an-header">
        <div>
          <Link to="/" className="an-logo">DirTera</Link>
          <div className="an-breadcrumb">
            <Link to="/dashboard">Dashboard</Link>
            <span>/</span>
            <span>{stats?.website_name ?? "Analytics"}</span>
          </div>
          <h1>Analytics</h1>
        </div>
        <button type="button" className="an-secondary-button" onClick={handleExport}>
          Export CSV
        </button>
      </header>

      {error && <p className="an-error" role="alert">{error}</p>}

      {loading ? (
        <p className="an-loading">Loading...</p>
      ) : (
        <>
          {summary && (
            <section className="an-summary-grid" aria-label="Summary stats">
              <StatCard label="Total clicks" value={summary.total_clicks} />
              <StatCard label="Today" value={summary.clicks_today} />
              <StatCard label="Last 7 days" value={summary.clicks_last_7_days} />
              <StatCard label="Last 30 days" value={summary.clicks_last_30_days} />
            </section>
          )}

          <section className="an-section">
            <div className="an-section-header">
              <div>
                <h2>Daily clicks</h2>
                <p>Click volume over the selected date range.</p>
              </div>
              <div className="an-date-range">
                <label>
                  From
                  <input
                    type="date"
                    value={startDate}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={today}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
            </div>

            {statsLoading ? (
              <p className="an-loading">Loading chart...</p>
            ) : (
              <div className="an-chart-wrapper">
                <BarChart data={stats?.data} />
              </div>
            )}
          </section>

          {summary && (
            <div className="an-tables">
              <section className="an-section an-table-section">
                <h2>Top referrers</h2>
                {summary.top_referrers.length === 0 ? (
                  <p className="an-empty">No referrer data yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr><th>Referrer</th><th>Clicks</th></tr>
                    </thead>
                    <tbody>
                      {summary.top_referrers.map((r) => (
                        <tr key={r.referrer}>
                          <td>{r.referrer}</td>
                          <td>{fmt(r.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="an-section an-table-section">
                <h2>Clicks by country</h2>
                {summary.clicks_by_country.length === 0 ? (
                  <p className="an-empty">No country data yet.</p>
                ) : (
                  <table className="an-table">
                    <thead>
                      <tr><th>Country</th><th>Clicks</th></tr>
                    </thead>
                    <tbody>
                      {summary.clicks_by_country.map((c) => (
                        <tr key={c.country}>
                          <td>{c.country}</td>
                          <td>{fmt(c.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default Analytics;
