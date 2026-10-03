import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/client";
import BusinessCard from "./BusinessCard";

/**
 * Fetches top listings for multiple categories in one request via
 * GET /api/v1/websites/multi-category.
 *
 * The endpoint returns one block per category slug:
 *   [{ category_slug, category_name, items: [...] }, ...]
 *
 * Props:
 *   categories   – string[] of category slugs (max 10)
 *   perCategory  – items per category block (1–20, default 4)
 *   domain       – optional domain slug to scope all blocks
 *   keywords     – optional keyword filter
 *   sortBy       – "score" | "rating" | "clicks" (default "score")
 */
function MultiCategoryFeed({
  categories = [],
  perCategory = 4,
  domain,
  keywords,
  sortBy = "score",
}) {
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (categories.length === 0) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        // The endpoint uses repeated params: ?categories=a&categories=b
        const params = new URLSearchParams();
        categories.forEach((slug) => params.append("categories", slug));
        params.set("per_category", perCategory);
        params.set("sort_by", sortBy);
        if (domain) params.set("domain", domain);
        if (keywords) params.set("keywords", keywords);

        const { data } = await api.get(
          `/api/v1/websites/multi-category?${params.toString()}`
        );

        setBlocks(Array.isArray(data) ? data : []);
      } catch {
        setError("We couldn't load category feeds right now.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [categories.join(","), perCategory, domain, keywords, sortBy]);

  if (isLoading) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">Loading category feeds...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">{error}</p>
        </div>
      </section>
    );
  }

  // Filter out blocks with no items
  const visibleBlocks = blocks.filter((block) => block.items?.length > 0);

  if (visibleBlocks.length === 0) {
    return null;
  }

  return (
    <>
      {visibleBlocks.map((block) => (
        <section key={block.category_slug} className="business-section">
          <div className="content-container">
            <div className="section-heading">
              <h2>{block.category_name || block.category_slug}</h2>
              <p>Top listings in this category.</p>
            </div>

            <div className="business-grid">
              {block.items.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>

            <div style={{ marginTop: "1rem" }}>
              <Link
                to={`/?category=${block.category_slug}`}
                className="pagination-button"
              >
                See all in {block.category_name || block.category_slug}
              </Link>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

export default MultiCategoryFeed;
