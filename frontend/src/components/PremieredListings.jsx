import { useEffect, useState } from "react";

import api from "../api/client";
import BusinessCard from "./BusinessCard";

/**
 * Fetches premiered listings via GET /api/v1/websites/premiered.
 *
 * Props:
 *   pageSize  – items to show (1–100, default 6)
 *   sortBy    – "score" | "rating" | "clicks" (default "score")
 *   title     – section heading
 *   description – section subheading
 */
function PremieredListings({
  pageSize = 6,
  sortBy = "score",
  title = "Premiered listings",
  description = "Hand-picked businesses featured on DirTera.",
}) {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/api/v1/websites/premiered", {
          params: { page: 1, page_size: pageSize, sort_by: sortBy },
        });
        setListings(Array.isArray(data) ? data : data.items ?? []);
      } catch {
        // Fail silently — section simply won't render
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [pageSize, sortBy]);

  if (isLoading) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">Loading premiered listings...</p>
        </div>
      </section>
    );
  }

  if (listings.length === 0) {
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
      </div>
    </section>
  );
}

export default PremieredListings;
