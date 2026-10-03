import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "../styles/reviews.css";

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="star-picker" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= (hovered || value) ? "active" : ""}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ websiteId, existing, onSaved, onCancel }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(existing);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a rating."); return; }
    setError("");
    setLoading(true);
    try {
      const payload = { rating, body: body.trim() || null };
      const { data } = isEdit
        ? await api.patch(`/api/v1/reviews/${existing.id}`, payload)
        : await api.post(`/api/v1/reviews/${websiteId}`, payload);
      onSaved(data, isEdit);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        className="review-textarea"
        placeholder="Share your experience (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
      />
      {error && <p className="review-error">{error}</p>}
      <div className="review-form-actions">
        {onCancel && (
          <button type="button" className="review-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="review-btn-primary" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update review" : "Post review"}
        </button>
      </div>
    </form>
  );
}

function ReviewItem({ review, currentUserId, isAdmin, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwn = currentUserId && review.author_id === currentUserId;

  const handleDelete = async () => {
    if (!window.confirm("Delete this review?")) return;
    setDeleting(true);
    try {
      const url = isAdmin && !isOwn
        ? `/api/v1/reviews/${review.id}/admin`
        : `/api/v1/reviews/${review.id}`;
      await api.delete(url);
      onDeleted(review.id);
    } catch {
      setDeleting(false);
    }
  };

  const handleToggleHide = async () => {
    try {
      const { data } = await api.patch(
        `/api/v1/reviews/${review.id}/hide?hide=${review.is_visible}`
      );
      onUpdated(data);
    } catch { /* silent */ }
  };

  if (editing) {
    return (
      <li className="review-item">
        <ReviewForm
          websiteId={review.website_id}
          existing={review}
          onSaved={(updated) => { onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`review-item${!review.is_visible ? " review-hidden" : ""}`}>
      <div className="review-item-header">
        <span className="review-stars">
          {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
        </span>
        <span className="review-date">
          {new Date(review.created_at).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
        {!review.is_visible && <span className="review-hidden-badge">Hidden</span>}
      </div>
      {review.body && <p className="review-body">{review.body}</p>}
      <div className="review-item-actions">
        {isOwn && (
          <>
            <button className="review-action-btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="review-action-btn danger" onClick={handleDelete} disabled={deleting}>Delete</button>
          </>
        )}
        {isAdmin && !isOwn && (
          <>
            <button className="review-action-btn" onClick={handleToggleHide}>
              {review.is_visible ? "Hide" : "Show"}
            </button>
            <button className="review-action-btn danger" onClick={handleDelete} disabled={deleting}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}

export default function ReviewsSection({ websiteId }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.is_admin ?? false;

  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const PAGE_SIZE = 10;

  const loadReviews = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/v1/reviews/${websiteId}`, {
        params: { page: p, page_size: PAGE_SIZE },
      });
      setReviews(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(p);
      if (user) setHasReviewed(data.items.some((r) => r.author_id === user.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(1); }, [websiteId]);

  const handleSaved = (review, isEdit) => {
    if (isEdit) {
      setReviews((prev) => prev.map((r) => (r.id === review.id ? review : r)));
    } else {
      setReviews((prev) => [review, ...prev]);
      setTotal((t) => t + 1);
      setHasReviewed(true);
      setShowForm(false);
    }
  };

  const handleUpdated = (review) =>
    setReviews((prev) => prev.map((r) => (r.id === review.id ? review : r)));

  const handleDeleted = (id) => {
    const wasOwn = reviews.find((r) => r.id === id)?.author_id === user?.id;
    setReviews((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => t - 1);
    if (wasOwn) setHasReviewed(false);
  };

  return (
    <section className="business-detail-section reviews-section">
      <div className="reviews-header">
        <h2>
          Reviews {total > 0 && <span className="reviews-count">({total})</span>}
        </h2>
        {isAuthenticated && !hasReviewed && !showForm && (
          <button className="review-btn-primary" onClick={() => setShowForm(true)}>
            Write a review
          </button>
        )}
      </div>

      {showForm && (
        <ReviewForm
          websiteId={websiteId}
          onSaved={handleSaved}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p className="reviews-empty">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="reviews-empty">No reviews yet. Be the first!</p>
      ) : (
        <>
          <ul className="reviews-list">
            {reviews.map((r) => (
              <ReviewItem
                key={r.id}
                review={r}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="reviews-pagination">
              <button className="review-btn-ghost" disabled={page <= 1} onClick={() => loadReviews(page - 1)}>
                ← Prev
              </button>
              <span>{page} / {totalPages}</span>
              <button className="review-btn-ghost" disabled={page >= totalPages} onClick={() => loadReviews(page + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
