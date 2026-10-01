import { useEffect, useState } from "react";
import api from "../../api/client";

function AdminAnalytics() {
  const [websites, setWebsites] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        // Load all websites
        const { data } = await api.get("/api/v1/websites/admin/all");

        const websiteList = data.items ?? data;
        setWebsites(websiteList);

        // Load analytics for every website
        const results = await Promise.all(
          websiteList.map(async (site) => {
            try {
              const { data } = await api.get(
                `/api/v1/analytics/${site.id}/stats`
              );

              return {
                id: site.id,
                ...data,
              };
            } catch {
              return {
                id: site.id,
                website_name: site.name,
                total_clicks: 0,
                data: [],
              };
            }
          })
        );

        const analyticsMap = {};

        results.forEach((item) => {
          analyticsMap[item.id] = item;
        });

        setAnalytics(analyticsMap);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "Failed to load website analytics."
        );
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  const getClicksForWebsite = (websiteId) => {
    const stats = analytics[websiteId];

    if (!stats?.data) {
      return 0;
    }

    return stats.data
      .filter((day) => {
        // Start date
        if (startDate && day.date < startDate) {
          return false;
        }

        // End date
        if (endDate && day.date > endDate) {
          return false;
        }

        return true;
      })
      .reduce((total, day) => {
        return total + (day.clicks || 0);
      }, 0);
  };

  const resetDates = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Analytics</h1>

      <p className="admin-subtitle">
        Website traffic and click statistics.
      </p>

      {loading && (
        <p style={{ color: "#6b7280" }}>
          Loading analytics...
        </p>
      )}

      {error && (
        <p className="admin-error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {/* Date filter */}
          <div
            className="admin-card"
            style={{
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 16,
                width: "100%",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Start date
                </label>

                <input
                  type="date"
                  className="admin-input"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  End date
                </label>

                <input
                  type="date"
                  className="admin-input"
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                />
              </div>

              {/* Reset on right */}
              <div
                style={{
                  marginLeft: "auto",
                }}
              >
                <button
                  type="button"
                  className="admin-button-outline"
                  onClick={resetDates}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Websites */}
          <div className="admin-card">
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: 18,
              }}
            >
              Websites
            </h2>

            {websites.length === 0 ? (
              <p className="admin-empty">
                No websites found.
              </p>
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
                          {site.owner?.email ?? "—"}
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
                            {getClicksForWebsite(site.id)}
                          </strong>
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