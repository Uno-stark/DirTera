import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import "../../styles/dashboard.css";

function Dashboard() {
  const [listings, setListings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [listingsRes, notifRes] = await Promise.all([
          api.get("/api/v1/websites/my"),
          api.get("/api/v1/notifications", {
            params: { page: 1, page_size: 1, unread_only: true },
          }),
        ]);

        setListings(listingsRes.data.items || []);
        setUnreadCount(notifRes.data.total || 0);
      } catch (err) {
        setError(
          err.response?.data?.detail || "We couldn't load your dashboard."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const pendingCount = listings.filter((l) => l.status === "pending").length;
  const approvedCount = listings.filter((l) => l.status === "approved").length;
  const rejectedCount = listings.filter((l) => l.status === "rejected").length;

  return (
    <main className="dashboard-page">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="dashboard-header">
        <div>
          <Link to="/" className="dashboard-logo">
            DirTera
          </Link>
          <h1>My Dashboard</h1>
          <p>Manage your website listings and track their performance.</p>
        </div>

        <div className="dashboard-header-actions">
          <Link
            to="/subscriptions"
            className="dashboard-secondary-button"
          >
            Subscriptions
          </Link>

          <Link
            to="/notifications"
            className="dashboard-secondary-button dashboard-notif-link"
          >
            Notifications
            {unreadCount > 0 && (
              <span className="dashboard-notif-badge">{unreadCount}</span>
            )}
          </Link>

          <Link to="/dashboard/listings/new" className="dashboard-primary-button">
            Add listing
          </Link>
        </div>
      </header>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="dashboard-stats">
        <div className="dashboard-stat-card">
          <span>Total listings</span>
          <strong>{listings.length}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span>Rejected</span>
          <strong>{rejectedCount}</strong>
        </div>
      </section>

      {/* ── Listings ───────────────────────────────────────────────────── */}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>My listings</h2>
            <p>Your submitted websites appear here.</p>
          </div>
        </div>

        {isLoading && <p>Loading your listings...</p>}

        {!isLoading && error && (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && listings.length === 0 && (
          <div className="dashboard-empty">
            <h3>No listings yet</h3>
            <p>Add your first website to get started.</p>
            <Link
              to="/dashboard/listings/new"
              className="dashboard-primary-button"
            >
              Add your first listing
            </Link>
          </div>
        )}

        {!isLoading && !error && listings.length > 0 && (
          <div className="dashboard-listings">
            {listings.map((listing) => (
              <article key={listing.id} className="dashboard-listing-card">
                <div className="dashboard-listing-info">
                  {listing.image_urls?.[0] && (
                    <img
                      src={listing.image_urls[0]}
                      alt=""
                      className="dashboard-listing-thumb"
                    />
                  )}

                  <div>
                    <h3>{listing.name}</h3>
                    <p>{listing.short_description}</p>

                    <div className="dashboard-listing-meta">
                      <span
                        className={`dashboard-status-badge dashboard-status-${listing.status}`}
                      >
                        {listing.status}
                      </span>
                      <span>{listing.total_clicks} clicks</span>
                      {listing.avg_rating > 0 && (
                        <span>★ {listing.avg_rating.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="dashboard-listing-actions">
                  {listing.status === "approved" && (
                    <Link
                      to={`/analytics/${listing.id}`}
                      className="dashboard-secondary-button"
                    >
                      Analytics
                    </Link>
                  )}

                  {listing.status === "approved" && (
                    <Link
                      to={`/subscribe/${listing.id}`}
                      className="dashboard-secondary-button"
                    >
                      Subscribe
                    </Link>
                  )}

                  <Link
                    to={`/dashboard/listings/${listing.id}/edit`}
                    className="dashboard-secondary-button"
                  >
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
