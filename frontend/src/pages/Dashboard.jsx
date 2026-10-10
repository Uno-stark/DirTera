import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import { fetchMyListings, keys } from "../api/queries";
import "../styles/dashboard.css";

function Dashboard() {
  const [deletingId, setDeletingId] = useState(null);
  
  const { data, isLoading, isError, error } = useQuery({
    queryKey: keys.myListings(),
    queryFn: fetchMyListings,
    staleTime: 2 * 60_000, // 2 minutes
  });

  const listings = data?.items || [];

  const pendingCount = listings.filter(
    (listing) => listing.status === "pending"
  ).length;

  const approvedCount = listings.filter(
    (listing) => listing.status === "approved"
  ).length;

  const rejectedCount = listings.filter(
    (listing) => listing.status === "rejected"
  ).length;

  const handleDelete = async (listing) => {
    if (!window.confirm(`Delete "${listing.name}"? This cannot be undone.`)) return;
    setDeletingId(listing.id);
    try {
      await api.delete(`/api/v1/websites/${listing.id}`);
      // Invalidate query to refetch listings
      window.location.reload(); // Simple approach for now
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete listing.");
    } finally {
      setDeletingId(null);
    }
  };

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

        {isError && (
          <p className="dashboard-error" role="alert">
            {error?.response?.data?.detail || "We couldn't load your listings."}
          </p>
        )}

        {!isLoading && !isError && listings.length === 0 && (
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

        {!isLoading && !isError && listings.length > 0 && (
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

                <div className="dashboard-listing-actions">
                  <Link
                    to={`/dashboard/listings/${listing.id}/analytics`}
                    className="dashboard-secondary-button"
                  >
                    Analytics
                  </Link>
                  {listing.status === "approved" && (
                    <Link
                      to={`/dashboard/listings/${listing.id}/subscribe`}
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
                  <button
                    type="button"
                    className="dashboard-danger-button"
                    disabled={deletingId === listing.id}
                    onClick={() => handleDelete(listing)}
                  >
                    {deletingId === listing.id ? "Deleting..." : "Delete"}
                  </button>
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

