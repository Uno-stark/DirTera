import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import "../styles/dashboard.css";

function Dashboard() {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadListings = async () => {
      try {
        const { data } = await api.get("/api/v1/websites/my");
        setListings(data.items || []);
      } catch (error) {
        setError(
          error.response?.data?.detail ||
            "We couldn't load your listings."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadListings();
  }, []);

  const pendingCount = listings.filter(
    (listing) => listing.status === "pending"
  ).length;

  const approvedCount = listings.filter(
    (listing) => listing.status === "approved"
  ).length;

  const rejectedCount = listings.filter(
    (listing) => listing.status === "rejected"
  ).length;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <Link to="/" className="dashboard-logo">
            DirTera
          </Link>
          <h1>My Dashboard</h1>
          <p>Manage your website listings and track their performance.</p>
        </div>

        <Link to="/dashboard/listings/new" className="dashboard-primary-button">
          Add listing
        </Link>
      </header>

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

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>My listings</h2>
            <p>Your submitted websites appear here.</p>
          </div>
        </div>

        {isLoading && <p>Loading your listings...</p>}

        {error && (
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
                <div>
                  <h3>{listing.name}</h3>
                  <p>{listing.short_description}</p>

                  <div className="dashboard-listing-meta">
                    <span>Status: {listing.status}</span>
                    <span>Clicks: {listing.total_clicks}</span>
                    <span>Rating: {listing.avg_rating}</span>
                  </div>
                </div>

                <Link
                  to={`/dashboard/listings/${listing.id}/edit`}
                  className="dashboard-secondary-button"
                >
                  Edit
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;

