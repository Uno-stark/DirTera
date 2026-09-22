import { useEffect, useState } from "react";

import api from "../api/client";
import BusinessCard from "./BusinessCard";
import "../styles/business-list.css";

function BusinessList({ selectedCategory, searchQuery }) {
  const [businesses, setBusinesses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryName, setCategoryName] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const loadBusinesses = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get("/api/v1/websites", {
          params: {
            page,
            page_size: 6,
            sort_by: "score",
            ...(selectedCategory && {
              category: selectedCategory,
            }),
            ...(searchQuery && {
              keywords: searchQuery,
            }),
          },
        });

        setBusinesses(response.data.items);
        setTotalPages(response.data.total_pages || 1);
      } catch {
        setError("We couldn't load businesses right now.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBusinesses();
  }, [page, selectedCategory, searchQuery]);

  useEffect(() => {
    const loadCategoryName = async () => {
      if (!selectedCategory) {
        setCategoryName("");
        return;
      }

      try {
        const response = await api.get("/api/v1/categories");

        const category = response.data.find(
          (item) => item.slug === selectedCategory
        );

        setCategoryName(category?.name || selectedCategory);
      } catch {
        setCategoryName(selectedCategory);
      }
    };

    loadCategoryName();
  }, [selectedCategory]);

  if (isLoading) {
    return (
      <section className="business-section">
        <div className="content-container">
          <p className="business-status">Loading businesses...</p>
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

  let heading = "Popular businesses";
  let description = "Explore businesses listed on DirTera.";

  if (searchQuery && categoryName) {
    heading = `Search results for "${searchQuery}" in ${categoryName}`;
    description = "Businesses matching your search in this category.";
  } else if (searchQuery) {
    heading = `Search results for "${searchQuery}"`;
    description = "Businesses matching your search.";
  } else if (categoryName) {
    heading = `Businesses in ${categoryName}`;
    description = "Explore businesses in the selected category.";
  }

  return (
    <section className="business-section">
      <div className="content-container">
        <div className="section-heading">
          <h2>{heading}</h2>
          <p>{description}</p>
        </div>

        {businesses.length === 0 ? (
          <p className="business-status">
            No approved listings match your search.
          </p>
        ) : (
          <>
            <div className="business-grid">
              {businesses.map((business) => (
                <BusinessCard
                  key={business.id}
                  business={business}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="pagination-button"
                  disabled={page === 1}
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                >
                  Previous
                </button>

                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  className="pagination-button"
                  disabled={page === totalPages}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
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