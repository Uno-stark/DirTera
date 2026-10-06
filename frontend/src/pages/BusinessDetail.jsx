import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../api/client";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import "../styles/business-detail.css";

// ── Star rating input ──────────────────────────────────────────────────────────
function StarInput({ value, onChange, disabled }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-input" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-input-btn ${
            star <= (hovered || value) ? "filled" : ""
          }`}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => !disabled && setHovered(0)}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          disabled={disabled}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Static star display ────────────────────────────────────────────────────────
function StarDisplay({ value }) {
  return (
    <span className="star-display" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? "star-filled" : "star-empty"}>
          ★
        </span>
      ))}
    </span>
  );
}

// ── Review form (submit or edit) ───────────────────────────────────────────────
function ReviewForm({ websiteId, existing, onSuccess, onCancel }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [body, setBody] = useState(existing?.body || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(existing);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      setError("Please select a rating.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      if (isEdit) {
        const { data } = await api.patch(`/api/v1/reviews/${existing.id}`, {
          rating,
          body: body.trim() || null,
        });
        onSuccess(data, "edit");
      } else {
        const { data } = await api.post(`/api/v1/reviews/${websiteId}`, {
          rating,
          body: body.trim() || null,
        });
        onSuccess(data, "create");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setError("You have already reviewed this listing.");
      } else {
        setError(
          typeof detail === "string"
            ? detail
            : "We couldn't submit your review. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="review-form-rating">
        <label>Your rating *</label>
        <StarInput value={rating} onChange={setRating} disabled={isSubmitting} />
      </div>

      <div className="review-form-body">
        <label htmlFor="review-body">Review (optional)</label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your experience..."
          rows={4}
          maxLength={2000}
          disabled={isSubmitting}
        />
        <small>{body.length}/2000</small>
      </div>

      {error && (
        <p className="review-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="review-form-actions">
        {onCancel && (
          <button
            type="button"
            className="review-cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          className="review-submit-button"
          disabled={isSubmitting || rating === 0}
        >
          {isSubmitting
            ? isEdit ? "Saving..." : "Submitting..."
            : isEdit ? "Save changes" : "Submit review"}
        </button>
      </div>
    </form>
  );
}

// ── Single review item ─────────────────────────────────────────────────────────
function ReviewItem({ review, currentUserId, onEdit, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwn = currentUserId && review.author_id === currentUserId;

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const handleDelete = async () => {
    if (!window.confirm("Delete your review?")) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/reviews/${review.id}`);
      onDelete(review.id);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className="review-item">
      <div className="review-item-header">
        <StarDisplay value={review.rating} />
        <time className="review-item-date">{formatDate(review.created_at)}</time>
      </div>

      {review.body && (
        <p className="review-item-body">{review.body}</p>
      )}

      {isOwn && (
        <div className="review-item-actions">
          <button
            type="button"
            className="review-action-button"
            onClick={() => onEdit(review)}
          >
            Edit
          </button>
          <button
            type="button"
            className="review-action-button review-delete-button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reviews section ────────────────────────────────────────────────────────────
function ReviewsSection({ websiteId }) {
  const { user, isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Which mode the form is in: null | "create" | review object (edit)
  const [formMode, setFormMode] = useState(null);

  // The current user's own review if they already submitted one
  const [ownReview, setOwnReview] = useState(null);

  const PAGE_SIZE = 10;

  const loadReviews = async (p = 1) => {
    setIsLoading(true);
    setLoadError("");

    try {
      const { data } = await api.get(`/api/v1/reviews/${websiteId}`, {
        params: { page: p, page_size: PAGE_SIZE },
      });

      setReviews(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);

      // Detect if current user already reviewed
      if (user) {
        const mine = data.items.find((r) => r.author_id === user.id);
        if (mine) setOwnReview(mine);
      }
    } catch {
      setLoadError("We couldn't load reviews.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews(page);
  }, [websiteId, page]);

  // After creating a review
  const handleSuccess = (review, mode) => {
    setFormMode(null);

    if (mode === "create") {
      setReviews((prev) => [review, ...prev]);
      setTotal((t) => t + 1);
      setOwnReview(review);
    } else {
      // edit
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? review : r))
      );
      setOwnReview(review);
    }
  };

  // After deleting
  const handleDelete = (reviewId) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    setTotal((t) => Math.max(0, t - 1));
    setOwnReview(null);
  };

  const canLeaveReview = isAuthenticated && !ownReview && !formMode;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <section className="business-detail-section reviews-section">
      {/* ── Heading ──────────────────────────────────────────────────── */}
      <div className="reviews-heading">
        <div>
          <h2>
            Reviews
            {total > 0 && (
              <span className="reviews-count"> ({total})</span>
            )}
          </h2>

          {avgRating && (
            <div className="reviews-avg">
              <StarDisplay value={Math.round(Number(avgRating))} />
              <span>{avgRating} average</span>
            </div>
          )}
        </div>

        {canLeaveReview && (
          <button
            type="button"
            className="review-write-button"
            onClick={() => setFormMode("create")}
          >
            Write a review
          </button>
        )}

        {!isAuthenticated && (
          <Link to="/login" className="review-login-link">
            Sign in to leave a review
          </Link>
        )}
      </div>

      {/* ── Write / edit form ─────────────────────────────────────────── */}
      {formMode === "create" && (
        <div className="review-form-wrapper">
          <h3>Your review</h3>
          <ReviewForm
            websiteId={websiteId}
            onSuccess={handleSuccess}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {formMode && typeof formMode === "object" && (
        <div className="review-form-wrapper">
          <h3>Edit your review</h3>
          <ReviewForm
            websiteId={websiteId}
            existing={formMode}
            onSuccess={handleSuccess}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {/* ── Own review (read-only when not editing) ───────────────────── */}
      {ownReview && !formMode && (
        <div className="reviews-own">
          <p className="reviews-own-label">Your review</p>
          <ReviewItem
            review={ownReview}
            currentUserId={user?.id}
            onEdit={(r) => setFormMode(r)}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* ── Review list ───────────────────────────────────────────────── */}
      {isLoading && <p className="reviews-loading">Loading reviews...</p>}

      {!isLoading && loadError && (
        <p className="reviews-error" role="alert">{loadError}</p>
      )}

      {!isLoading && !loadError && reviews.length === 0 && !ownReview && (
        <p className="reviews-empty">
          No reviews yet.{" "}
          {isAuthenticated
            ? "Be the first to leave one."
            : "Sign in to be the first."}
        </p>
      )}

      {!isLoading && !loadError && reviews.length > 0 && (
        <div className="reviews-list">
          {reviews
            .filter((r) => !ownReview || r.id !== ownReview.id)
            .map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                currentUserId={user?.id}
                onEdit={(r) => setFormMode(r)}
                onDelete={handleDelete}
              />
            ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="reviews-pagination">
          <button
            type="button"
            className="reviews-page-button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            className="reviews-page-button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
        const { data } = await api.get(`/api/v1/websites/${websiteId}`);
        setBusiness(data);
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
            <p className="business-detail-status">Loading business...</p>
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
    ? business.tags.split(",").map((t) => t.trim()).filter(Boolean)
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
            {/* ── Header ─────────────────────────────────────────────── */}
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
                <span className="verified-badge">Verified</span>
              )}
            </div>

            {/* ── Meta ───────────────────────────────────────────────── */}
            <div className="business-detail-meta">
              {business.domain_slug && (
                <span>{business.domain_slug}</span>
              )}

              {business.avg_rating > 0 && (
                <span>
                  <StarDisplay value={Math.round(business.avg_rating)} />
                  {" "}{business.avg_rating.toFixed(1)}
                </span>
              )}

              {business.review_count > 0 && (
                <span>
                  {business.review_count}{" "}
                  {business.review_count === 1 ? "review" : "reviews"}
                </span>
              )}

              {business.total_clicks > 0 && (
                <span>{business.total_clicks.toLocaleString()} visits</span>
              )}
            </div>

            {/* ── Visit button ────────────────────────────────────────── */}
            {business.url && (
              <div className="business-detail-actions">
                <a
                  href={`${
                    import.meta.env.VITE_API_URL || "http://localhost:8000"
                  }/api/v1/websites/${business.id}/click`}
                  target="_blank"
                  rel="noreferrer"
                  className="business-visit-button"
                >
                  Visit website
                </a>
              </div>
            )}

            {/* ── About ───────────────────────────────────────────────── */}
            {business.full_description && (
              <section className="business-detail-section">
                <h2>About this business</h2>
                <p>{business.full_description}</p>
              </section>
            )}

            {/* ── Tags ────────────────────────────────────────────────── */}
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

            {/* ── Contact ─────────────────────────────────────────────── */}
            <section className="business-detail-section">
              <h2>Contact</h2>
              <div className="business-contact">
                {business.contact_email && (
                  <p>
                    <strong>Email:</strong>{" "}
                    <a href={`mailto:${business.contact_email}`}>
                      {business.contact_email}
                    </a>
                  </p>
                )}

                {business.phone_number && (
                  <p>
                    <strong>Phone:</strong> {business.phone_number}
                  </p>
                )}

                {!business.contact_email && !business.phone_number && (
                  <p>No contact information provided.</p>
                )}
              </div>
            </section>

            {/* ── Social ──────────────────────────────────────────────── */}
            {socialLinks.length > 0 && (
              <section className="business-detail-section">
                <h2>Social media</h2>
                <div className="business-social-links">
                  {socialLinks.map(([name, url]) => (
                    <a key={name} href={url} target="_blank" rel="noreferrer">
                      {name}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* ── Reviews ─────────────────────────────────────────────── */}
            <ReviewsSection websiteId={websiteId} />
          </article>
        </div>
      </main>
    </>
  );
}

export default BusinessDetail;
