import { memo } from "react";
import { Link } from "react-router-dom";

import Stars from "./Stars";
import "../styles/business.css";


function toWebpUrl(url) {
  if (!url) return null;
  const converted = url.replace(/\.(jpe?g|png)($|\?)/i, ".webp$2");
  return converted !== url ? converted : null;
}


function ResponsiveImage({ src, alt = "", className, loading = "lazy", width, height }) {
  const webp = toWebpUrl(src);

  if (!webp) {
    return <img src={src} alt={alt} className={className} loading={loading} width={width} height={height} />;
  }

  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      <img src={src} alt={alt} className={className} loading={loading} width={width} height={height} />
    </picture>
  );
}

export { ResponsiveImage };

function BusinessCard({ business }) {
  return (
    <Link to={`/businesses/${business.id}`} className="business-card-link">
      <article className="business-card">
        {/* Thumbnail — first gallery image with WebP source */}
        {business.image_urls?.[0] && (
          <div className="business-card-thumb">
            <ResponsiveImage src={business.image_urls[0]} alt="" loading="lazy" />
          </div>
        )}

        <div className="business-card-body">
          {business.avg_rating > 0 && (
            <div className="business-card-rating">
              <Stars
                value={business.avg_rating}
                size={12}
                filled="card-star filled"
                empty="card-star empty"
              />
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

          <h3 className="business-card-name">{business.name}</h3>

          {business.short_description && (
            <p className="business-card-desc">{business.short_description}</p>
          )}

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

export default memo(BusinessCard);
