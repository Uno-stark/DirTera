import { useEffect, useState } from "react";

import api from "../api/client";
import "../styles/categories.css";

function CategoryList({ selectedCategory, onCategorySelect }) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.get("/api/v1/categories");
        setCategories(response.data);
      } catch {
        setError("We couldn't load categories right now.");
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  return (
    <section className="categories-section">
      <div className="content-container">
        <div className="section-heading">
          <h2>Browse by category</h2>
          <p>Find businesses based on what you need.</p>
        </div>

        {isLoading && (
          <p className="category-status">Loading categories...</p>
        )}

        {error && (
          <p className="category-status">{error}</p>
        )}

        {!isLoading && !error && (
          <div className="category-list">
            <button
              type="button"
              className={`category-item ${
                !selectedCategory ? "category-item-active" : ""
              }`}
              onClick={() => onCategorySelect("")}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`category-item ${
                  selectedCategory === category.slug
                    ? "category-item-active"
                    : ""
                }`}
                onClick={() => onCategorySelect(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default CategoryList;