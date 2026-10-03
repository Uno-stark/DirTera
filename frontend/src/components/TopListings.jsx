import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client";
import BusinessCard from "./BusinessCard";


function TopListings({
  limit = 6,
  category,
  domain,
  keywords,
  sortBy = "score",
  title = "Top listings",
  description = "The highest-rated and most visited businesses on DirTera.",
}) {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const { data } = await api.get("/api/v1/websites/top", {
          params: {
            limit,
            sort_by: sortBy,
            ...(category && { category }),
            ...(domain && { domain }),
            ...(keywords && { keywords }),
          },
        });

        // Endpoint may return an array or a { items: [] } envelope
        setListings(Array.isArray(data) ? data : data.items ?? []);
      } catch {
        setError("We couldn't load top listings right now.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [limit, category, domain, keywords, sortBy]);

  if (isLoading) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">Loading top listings...</p>
        </div>
      </section>
    );
  }

  if (error || listings.length === 0) {
    return null;
  }

  return (
    <section className="business-section">
      <div className="content-container">
        <div className="section-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="business-grid">
          {listings.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <Link to="/?sort=score" className="pagination-button">
            View all listings
          </Link>
        </div>
      </div>
    </section>
  );
}

export default TopListings;
