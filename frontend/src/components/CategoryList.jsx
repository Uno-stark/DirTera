import "../styles/categories.css";
import { useTaxonomy } from "../context/TaxonomyContext";

function CategoryList({ selectedCategory, onCategorySelect }) {
  const { categories, isLoading } = useTaxonomy();

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

        {!isLoading && (
          <div className="category-list">
            <button
              type="button"
              className={`category-item ${!selectedCategory ? "category-item-active" : ""}`}
              onClick={() => onCategorySelect("")}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`category-item ${
                  selectedCategory === category.slug ? "category-item-active" : ""
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
