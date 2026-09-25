import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../api/client";
import Navbar from "../components/Navbar";
import "../styles/business-detail.css";

function BusinessDetail() {
  const { websiteId } = useParams();

  const [business, setBusiness] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBusiness = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await api.get(
          `/api/v1/websites/${websiteId}`
        );

        setBusiness(response.data);
      } catch {
        setError("We couldn't load this business.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBusiness();
  }, [websiteId]);

  if (isLoading) {
    return (
      <>
        <Navbar />

        <main className="business-detail-page">
          <div className="content-container">
            <p className="business-detail-status">
              Loading business...
            </p>
          </div>
        </main>
      </>
    );
  }

  if (error || !business) {
    return (
      <>
        <Navbar />

        <main className="business-detail-page">
          <div className="content-container">
            <p className="business-detail-status">
              {error || "Business not found."}
            </p>

            <Link to="/" className="business-back-link">
              Back to directory
            </Link>
          </div>
        </main>
      </>
    );
  }

  const tags = business.tags
    ? business.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  let socialLinks = [];

  if (business.social_links) {
    try {
      const parsed = JSON.parse(business.social_links);

      if (parsed && typeof parsed === "object") {
        socialLinks = Object.entries(parsed);
      }
    } catch {
      socialLinks = [];
    }
  }

  return (
    <>
      <Navbar />

      <main className="business-detail-page">
        <div className="content-container">
          <Link to="/" className="business-back-link">
            ← Back to directory
          </Link>

          <article className="business-detail-card">
            <div className="business-detail-header">
              <div className="business-detail-identity">
                {business.logo_url && (
                  <img
                    src={business.logo_url}
                    alt={`${business.name} logo`}
                    className="business-detail-logo"
                  />
                )}

                <div>
                  <p className="business-detail-category">
                    {business.category_slug || "Business"}
                  </p>

                  <h1>{business.name}</h1>

                  {business.short_description && (
                    <p className="business-detail-short-description">
                      {business.short_description}
                    </p>
                  )}
                </div>
              </div>

              {business.is_verified && (
                <span className="verified-badge">
                  Verified
                </span>
              )}
            </div>

            <div className="business-detail-meta">
              {business.domain_slug && (
                <span>{business.domain_slug}</span>
              )}

              {business.avg_rating > 0 && (
                <span>
                  ★ {business.avg_rating.toFixed(1)}
                </span>
              )}

              {business.review_count > 0 && (
                <span>
                  {business.review_count} reviews
                </span>
              )}
            </div>

            {business.url && (
              <div className="business-detail-actions">
              <a
                href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/v1/websites/${business.id}/click`}
                target="_blank"
                rel="noreferrer"
                className="business-visit-button"
                 >
                 Visit website
                 </a>
              </div>
            )}

            {business.full_description && (
              <section className="business-detail-section">
                <h2>About this business</h2>

                <p>{business.full_description}</p>
              </section>
            )}

            {tags.length > 0 && (
              <section className="business-detail-section">
                <h2>Tags</h2>

                <div className="business-tags">
                  {tags.map((tag) => (
                    <span key={tag} className="business-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="business-detail-section">
              <h2>Contact</h2>

              <div className="business-contact">
                {business.contact_email && (
                  <p>
                    <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${business.contact_email}`}
                    >
                      {business.contact_email}
                    </a>
                  </p>
                )}

                {business.phone_number && (
                  <p>
                    <strong>Phone:</strong>{" "}
                    {business.phone_number}
                  </p>
                )}

                {!business.contact_email &&
                  !business.phone_number && (
                    <p>No contact information provided.</p>
                  )}
              </div>
            </section>

            {socialLinks.length > 0 && (
              <section className="business-detail-section">
                <h2>Social media</h2>

                <div className="business-social-links">
                  {socialLinks.map(([name, url]) => (
                    <a
                      key={name}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {name}
                    </a>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>
      </main>
    </>
  );
}

export default BusinessDetail;