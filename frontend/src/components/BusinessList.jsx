import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchWebsites, keys } from "../api/queries";
import { useTaxonomy } from "../context/TaxonomyContext";
import BusinessCard from "./BusinessCard";
import "../styles/business-list.css";

function BusinessList({ selectedCategory, searchQuery }) {
  const { categories } = useTaxonomy();
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [selectedCategory, searchQuery]);

  const queryParams = {
    page,
    page_size: 6,
    sort_by: "score",
    ...(selectedCategory && { category: selectedCategory }),
    ...(searchQuery      && { keywords: searchQuery }),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: keys.websites(queryParams),
    queryFn:  () => fetchWebsites(queryParams),
    staleTime: 30_000,
    // Keep previous page data visible while next page loads
    placeholderData: (prev) => prev,
  });

  const businesses = data?.items       ?? [];
  const totalPages = data?.total_pages ?? 1;

  // Resolve category display name from context — no extra fetch needed
  const categoryName = selectedCategory
    ? (categories.find((c) => c.slug === selectedCategory)?.name ?? selectedCategory)
    : "";

  let heading     = "Popular businesses";
  let description = "Explore businesses listed on DirTera.";

  if (searchQuery && categoryName) {
    heading     = `Search results for "${searchQuery}" in ${categoryName}`;
    description = "Businesses matching your search in this category.";
  } else if (searchQuery) {
    heading     = `Search results for "${searchQuery}"`;
    description = "Businesses matching your search.";
  } else if (categoryName) {
    heading     = `Businesses in ${categoryName}`;
    description = "Explore businesses in the selected category.";
  }

  if (isLoading) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">Loading businesses...</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">We couldn't load businesses right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="business-section">
      <div className="content-container">
        <div className="section-heading">
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>

        {businesses.length === 0 ? (
          <p className="business-status">No approved listings match your search.</p>
        ) : (
          <>
            <div className="business-grid">
              {businesses.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="pagination-info">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  className="pagination-button"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default BusinessList;
