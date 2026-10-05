import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import "../styles/business.css";

function StarRow({ value, size = 12 }) {
  const full  = Math.round(value);
  const empty = 5 - full;
  return (
    <span className="card-star-row" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} className="card-star filled" fill="currentColor" strokeWidth={0} />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} className="card-star empty" fill="none" strokeWidth={1.5} />
      ))}
    </span>
  );
}

function BusinessCard({ business }) {
  return (
    <Link to={`/businesses/${business.id}`} className="business-card-link">
      <article className="business-card">
        {/* Thumbnail — first gallery image */}
        {business.image_urls?.[0] && (
          <div className="business-card-thumb">
            <img src={business.image_urls[0]} alt="" loading="lazy" />
          </div>
        )}

        <div className="business-card-body">
          {/* Rating row */}
          {business.avg_rating > 0 && (
            <div className="business-card-rating">
              <StarRow value={business.avg_rating} />
              <span className="rating-score">{business.avg_rating.toFixed(1)}</span>
              {business.review_count > 0 && (
                <span className="rating-count">({business.review_count})</span>
              )}
              {business.category_slug && (
                <span className="rating-location">
                  {business.category_slug.replace(/_/g, " ")}
                </span>
              )}
            </div>
          )}

          {/* Name */}
          <h3 className="business-card-name">{business.name}</h3>

          {/* Description */}
          {business.short_description && (
            <p className="business-card-desc">{business.short_description}</p>
          )}

          {/* Footer meta */}
          <div className="business-card-footer">
            {business.domain_slug && (
              <span className="business-card-domain">
                {business.domain_slug.replace(/_/g, " ")}
              </span>
            )}

            <div className="business-card-badges">
              {business.is_verified && (
                <span className="badge badge-verified">Verified</span>
              )}
              {business.is_premiered && (
                <span className="badge badge-premier">Premier</span>
              )}
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default BusinessCard;
