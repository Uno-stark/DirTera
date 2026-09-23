import { Link } from "react-router-dom";

import "../styles/business.css";

function BusinessCard({ business }) {
  return (
    <Link
      to={`/businesses/${business.id}`}
      className="business-card-link"
    >
      <article className="business-card">
        <div className="business-card-content">
          <div className="business-card-header">
            <div>
              <p className="business-category">
                {business.category_slug || "Business"}
              </p>

              <h3>{business.name}</h3>
            </div>

            {business.is_verified && (
              <span className="verified-badge">Verified</span>
            )}
          </div>

          {business.short_description && (
            <p className="business-description">
              {business.short_description}
            </p>
          )}

          <div className="business-meta">
            {business.domain_slug && (
              <span>{business.domain_slug}</span>
            )}

            {business.avg_rating > 0 && (
              <span>★ {business.avg_rating.toFixed(1)}</span>
            )}

            {business.review_count > 0 && (
              <span>{business.review_count} reviews</span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export default BusinessCard;