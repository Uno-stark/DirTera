import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BadgeCheck, ChevronLeft,
  ExternalLink, Globe, Mail, MessageSquarePlus, Pencil, Phone,
  Star, Trash2,
} from "lucide-react";

import api from "../api/client";
import { fetchWebsiteDetail, fetchReviews, keys } from "../api/queries";
import Navbar from "../components/Navbar";
import SiteFooter from "../components/SiteFooter";
import { useAuth } from "../context/AuthContext";
import { fmtDate } from "../utils/format";
import "../styles/business-detail.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─────────────────────────────────────────────────────────────────────────────
// Hero gallery — stable interval via activeRef (no stale-closure re-creation)
// Enhanced with smooth crossfade transitions
// ─────────────────────────────────────────────────────────────────────────────
function HeroGallery({ images, logoUrl, name, avgRating, reviewCount, isVerified, shortDesc }) {
  const [active,    setActive]    = useState(0);
  const [direction, setDirection] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef  = useRef(null);
  const activeRef = useRef(0);

  const slides = images.length > 0 ? images : [null];
  const total  = slides.length;

  useEffect(() => { activeRef.current = active; }, [active]);

  const goTo = useCallback((idx, dir = 1) => {
    if (isTransitioning) return; // Prevent rapid clicks during transition
    setDirection(dir);
    setIsTransitioning(true);
    setActive((idx + total) % total);
    
    // Reset transitioning flag after animation completes
    setTimeout(() => setIsTransitioning(false), 800);
  }, [total, isTransitioning]);

  useEffect(() => {
    if (total <= 1) return;
    timerRef.current = setInterval(() => {
      goTo((activeRef.current + 1) % total, 1);
    }, 5000); // Slightly longer interval for smoother experience
    return () => clearInterval(timerRef.current);
  }, [total, goTo]);

  const handleDotClick = (i) => {
    if (i === activeRef.current || isTransitioning) return; // Skip if already active or transitioning
    clearInterval(timerRef.current);
    goTo(i, i > activeRef.current ? 1 : -1);
    if (total > 1) {
      timerRef.current = setInterval(() => goTo((activeRef.current + 1) % total, 1), 5000);
    }
  };

  return (
    <div className="bd-hero">
      <div className="bd-hero-bg" aria-hidden="true">
        {slides.map((src, i) => (
          <div key={i} className={`bd-hero-bg-slide${i === active ? " active" : ""}`}
            style={src ? { backgroundImage: `url(${src})` } : {}} />
        ))}
      </div>

      <div className="bd-hero-track">
        {slides.map((src, i) => (
          <div key={i} className={`bd-hero-slide${i === active ? " active" : ""}${direction < 0 ? " dir-bwd" : ""}`}>
            {src ? <img src={src} alt={`${name} screenshot ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} /> : <div className="bd-hero-placeholder" />}
          </div>
        ))}
      </div>

      <div className="bd-hero-scrim" aria-hidden="true" />

      {total > 1 && (
        <div className="bd-hero-dots" role="tablist">
          {slides.map((_, i) => (
            <button key={i} type="button" role="tab"
              aria-selected={i === active}
              className={`bd-hero-dot${i === active ? " active" : ""}`}
              onClick={() => handleDotClick(i)}
              aria-label={`Image ${i + 1}`} />
          ))}
        </div>
      )}

      <div className="bd-hero-identity">
        <div className="bd-hero-logo">
          {logoUrl
            ? <img src={logoUrl} alt="" loading="eager" />
            : <span className="bd-hero-logo-initial">{name.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="bd-hero-info">
          <div className="bd-hero-name-row">
            <h1 className="bd-hero-name">{name}</h1>
            {isVerified && (
              <span className="bd-hero-verified" aria-label="Verified listing">
                <BadgeCheck size={16} strokeWidth={2} />
              </span>
            )}
          </div>
          {avgRating > 0 && (
            <div className="bd-hero-rating">
              <HeroStars value={avgRating} />
              <span className="bd-hero-rating-val">{avgRating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="bd-hero-rating-count">
                  ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                </span>
              )}
            </div>
          )}
          {shortDesc && <p className="bd-hero-desc">{shortDesc}</p>}
        </div>
      </div>
    </div>
  );
}

function HeroStars({ value }) {
  return (
    <span className="bd-hero-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={13}
          fill={s <= Math.round(value) ? "currentColor" : "none"}
          strokeWidth={s <= Math.round(value) ? 0 : 1.5}
          className={s <= Math.round(value) ? "bd-star-on" : "bd-star-off"} />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function Sidebar({ business, tags, socialLinks }) {
  const visitUrl = `${API_BASE}/api/v1/websites/${business.id}/click`;

  return (
    <aside className="bd-sidebar">
      <div className="bd-sidebar-block">
        <p className="bd-sidebar-eyebrow">Discover the website</p>
        <a href={visitUrl} target="_blank" rel="noreferrer" className="bd-visit-btn">
          Visit website <ExternalLink size={13} strokeWidth={2} />
        </a>
        <p className="bd-visit-note">Opens in a new tab · click is recorded</p>
      </div>

      {tags.length > 0 && (
        <div className="bd-sidebar-block">
          <p className="bd-sidebar-eyebrow">Filed under</p>
          <div className="bd-sidebar-tags">
            {tags.map((tag) => <span key={tag} className="bd-sidebar-tag">{tag}</span>)}
          </div>
        </div>
      )}

      {(business.full_description || business.short_description) && (
        <div className="bd-sidebar-block">
          <p className="bd-sidebar-heading">About {business.name}</p>
          <p className="bd-sidebar-about">{business.full_description || business.short_description}</p>
          <div className="bd-sidebar-meta-rows">
            {business.category_slug && (
              <div className="bd-meta-row">
                <span className="bd-meta-key">Category</span>
                <span className="bd-meta-val">{business.category_slug.replace(/_/g, " ")}</span>
              </div>
            )}
            {business.domain_slug && (
              <div className="bd-meta-row">
                <span className="bd-meta-key">Domain</span>
                <span className="bd-meta-val">{business.domain_slug.replace(/_/g, " ")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(business.contact_email || business.phone_number || socialLinks.length > 0) && (
        <div className="bd-sidebar-block">
          <p className="bd-sidebar-heading">Get in touch</p>
          <div className="bd-sidebar-contact">
            {business.contact_email && (
              <a href={`mailto:${business.contact_email}`} className="bd-contact-row">
                <Mail size={13} /><span>{business.contact_email}</span>
                <ExternalLink size={10} className="bd-contact-ext" />
              </a>
            )}
            {business.phone_number && (
              <a href={`tel:${business.phone_number}`} className="bd-contact-row">
                <Phone size={13} /><span>{business.phone_number}</span>
              </a>
            )}
            {socialLinks.map(([label, url]) => (
              <a key={label} href={url} target="_blank" rel="noreferrer" className="bd-contact-row">
                <Globe size={13} /><span>{label}</span>
                <ExternalLink size={10} className="bd-contact-ext" />
              </a>
            ))}
          </div>
        </div>
      )}

      {business.created_at && (
        <div className="bd-sidebar-block">
          <p className="bd-sidebar-eyebrow">In the register since</p>
          <p className="bd-sidebar-since-val">
            {new Date(business.created_at).toLocaleDateString("en-GB", {
              month: "short", year: "numeric",
            }).toUpperCase()}
          </p>
        </div>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Star widgets
// ─────────────────────────────────────────────────────────────────────────────
function StarInput({ value, onChange, disabled }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="star-input" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((s) => {
        const lit = s <= (hovered || value);
        return (
          <button key={s} type="button"
            className={`star-input-btn${lit ? " filled" : ""}`}
            onClick={() => !disabled && onChange(s)}
            onMouseEnter={() => !disabled && setHovered(s)}
            onMouseLeave={() => !disabled && setHovered(0)}
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            aria-pressed={s === value}
            disabled={disabled}>
            <Star size={24} strokeWidth={1.5} fill={lit ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

function StarDisplay({ value, size = 13 }) {
  return (
    <span className="star-display" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} strokeWidth={1.5}
          fill={s <= value ? "currentColor" : "none"}
          className={s <= value ? "star-filled" : "star-empty"} />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 36 }) {
  return (
    <div className="bd-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true">
      {avatarUrl
        ? <img src={avatarUrl} alt="" loading="lazy" />
        : <span>{(name || "?").charAt(0).toUpperCase()}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review form
// ─────────────────────────────────────────────────────────────────────────────
function ReviewForm({ websiteId, existing, onSuccess, onCancel }) {
  const [rating,       setRating]       = useState(existing?.rating || 0);
  const [body,         setBody]         = useState(existing?.body   || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error,        setError]        = useState("");
  const isEdit = Boolean(existing);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError("Please select a rating."); return; }
    setError("");
    setIsSubmitting(true);
    try {
      if (isEdit) {
        const { data } = await api.patch(`/api/v1/reviews/${existing.id}`, { rating, body: body.trim() || null });
        onSuccess(data, "edit");
      } else {
        const { data } = await api.post(`/api/v1/reviews/${websiteId}`, { rating, body: body.trim() || null });
        onSuccess(data, "create");
      }
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(err.response?.status === 409
        ? "You have already reviewed this listing."
        : (typeof d === "string" ? d : "Couldn't submit. Please try again."));
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
        <textarea id="review-body" value={body} rows={4} maxLength={2000}
          disabled={isSubmitting} placeholder="Share your experience…"
          onChange={(e) => setBody(e.target.value)} />
        <small>{body.length} / 2000</small>
      </div>
      {error && <p className="review-form-error" role="alert">{error}</p>}
      <div className="review-form-actions">
        {onCancel && (
          <button type="button" className="review-cancel-button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        )}
        <button type="submit" className="review-submit-button" disabled={isSubmitting || !rating}>
          {isSubmitting ? (isEdit ? "Saving…" : "Submitting…") : (isEdit ? "Save changes" : "Submit review")}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review item
// ─────────────────────────────────────────────────────────────────────────────
function ReviewItem({ review, currentUserId, onEdit, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwn = currentUserId && review.author_id === currentUserId;
  const displayName = review.author_name || "Anonymous";

  const handleDelete = async () => {
    if (!window.confirm("Delete your review?")) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/reviews/${review.id}`);
      onDelete(review.id);
    } catch { setIsDeleting(false); }
  };

  return (
    <div className="review-item">
      <div className="review-item-top">
        <Avatar name={displayName} avatarUrl={review.author_avatar_url} />
        <div className="review-item-meta">
          <span className="review-item-author">{displayName}</span>
          <time className="review-item-date">{fmtDate(review.created_at)}</time>
        </div>
        {isOwn && (
          <div className="review-item-actions">
            <button type="button" className="review-action-btn" onClick={() => onEdit(review)}>
              <Pencil size={12} /> Edit
            </button>
            <button type="button" className="review-action-btn review-action-del"
              onClick={handleDelete} disabled={isDeleting}>
              <Trash2 size={12} /> {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
      <div className="review-item-stars">
        <StarDisplay value={review.rating} size={13} />
        <span className="review-item-score">{review.rating.toFixed(1)}</span>
      </div>
      {review.body && <p className="review-item-body">{review.body}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews section — React Query for data, local state for optimistic updates
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_REVIEWS = 5;

function ReviewsSection({ websiteId }) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [page,      setPage]      = useState(1);
  const [formMode,  setFormMode]  = useState(null);
  const [ownReview, setOwnReview] = useState(null);
  // Local overlay for optimistic add/edit/delete without full refetch
  const [localItems, setLocalItems] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: keys.reviews(websiteId, page),
    queryFn:  () => fetchReviews(websiteId, page, PAGE_SIZE_REVIEWS),
    // Show previous page while loading next — no blank flash
    placeholderData: (prev) => prev,
  });

  const reviews    = localItems ?? data?.items    ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Detect own review in freshly loaded data
  useEffect(() => {
    if (!user || !data?.items) return;
    const mine = data.items.find((r) => r.author_id === user.id);
    if (mine) setOwnReview(mine);
  }, [data, user]);

  // Reset local overlay when page changes (fresh data loads)
  useEffect(() => { setLocalItems(null); }, [page]);

  const handleSuccess = (review, mode) => {
    setFormMode(null);
    if (mode === "create") {
      setLocalItems((prev) => [review, ...(prev ?? data?.items ?? [])]);
      setOwnReview(review);
      // Invalidate so background refetch updates total count
      queryClient.invalidateQueries({ queryKey: keys.reviews(websiteId, page) });
    } else {
      setLocalItems((prev) =>
        (prev ?? data?.items ?? []).map((r) => r.id === review.id ? review : r)
      );
      setOwnReview(review);
    }
  };

  const handleDelete = (id) => {
    setLocalItems((prev) => (prev ?? data?.items ?? []).filter((r) => r.id !== id));
    setOwnReview(null);
    queryClient.invalidateQueries({ queryKey: keys.reviews(websiteId, page) });
  };

  const canWrite = isAuthenticated && !ownReview && !formMode;

  // Pagination pill builder
  const pageNumbers = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) pageNumbers.push(p);
  }

  return (
    <section className="bd-reviews-section">
      <div className="bd-reviews-heading">
        <div>
          <h2 className="bd-reviews-title">From the community</h2>
          <p className="bd-reviews-sub">Real experiences from people who use this business.</p>
        </div>
        {canWrite && (
          <button type="button" className="review-write-btn" onClick={() => setFormMode("create")}>
            <MessageSquarePlus size={14} /> Write a review
          </button>
        )}
        {!isAuthenticated && (
          <Link to="/login" className="review-login-link">Sign in to leave a review</Link>
        )}
      </div>

      {(formMode === "create" || (formMode && typeof formMode === "object")) && (
        <div className="review-form-wrapper">
          <h3>{formMode === "create" ? "Your review" : "Edit your review"}</h3>
          <ReviewForm websiteId={websiteId}
            existing={typeof formMode === "object" ? formMode : undefined}
            onSuccess={handleSuccess} onCancel={() => setFormMode(null)} />
        </div>
      )}

      {ownReview && !formMode && (
        <div className="bd-own-review">
          <p className="bd-own-label">Your review</p>
          <ReviewItem review={ownReview} currentUserId={user?.id}
            onEdit={(r) => setFormMode(r)} onDelete={handleDelete} />
        </div>
      )}

      {isLoading && <p className="bd-reviews-state">Loading reviews…</p>}
      {!isLoading && isError && <p className="bd-reviews-state bd-reviews-error">We couldn't load reviews.</p>}
      {!isLoading && !isError && reviews.length === 0 && !ownReview && (
        <p className="bd-reviews-state">
          No reviews yet. {isAuthenticated ? "Be the first to leave one." : "Sign in to be the first."}
        </p>
      )}

      {!isLoading && reviews.length > 0 && (
        <div className="bd-reviews-list">
          {reviews
            .filter((r) => !ownReview || r.id !== ownReview.id)
            .map((r) => (
              <ReviewItem key={r.id} review={r} currentUserId={user?.id}
                onEdit={(rv) => setFormMode(rv)} onDelete={handleDelete} />
            ))}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="bd-reviews-pagination">
          <span className="bd-reviews-pag-info">
            Showing {(page - 1) * PAGE_SIZE_REVIEWS + 1}–{Math.min(page * PAGE_SIZE_REVIEWS, total)} of {total} reviews
          </span>
          <div className="bd-reviews-pag-controls">
            <button type="button" className="bd-pag-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1} aria-label="Previous page">
              <ArrowLeft size={13} />
            </button>
            {pageNumbers.reduce((acc, p, i, arr) => {
              if (i > 0 && p - arr[i - 1] > 1)
                acc.push(<span key={`e${p}`} className="bd-pag-ellipsis">…</span>);
              acc.push(
                <button key={p} type="button"
                  className={`bd-pag-num${p === page ? " active" : ""}`}
                  onClick={() => setPage(p)} aria-current={p === page ? "page" : undefined}>
                  {p}
                </button>
              );
              return acc;
            }, [])}
            <button type="button" className="bd-pag-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages} aria-label="Next page">
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BusinessDetail — useQuery for main fetch; React Query handles background refetch
// ─────────────────────────────────────────────────────────────────────────────
function BusinessDetail() {
  const { websiteId } = useParams();
  const navigate      = useNavigate();

  const { data: business, isLoading, isError } = useQuery({
    queryKey: keys.websiteDetail(websiteId),
    queryFn:  () => fetchWebsiteDetail(websiteId),
    // Keep previous data while revalidating so the page doesn't blank on focus-refetch
    placeholderData: (prev) => prev,
  });

  if (isLoading && !business) {
    return (
      <>
        <Navbar />
        <div className="bd-state-page"><p>Loading…</p></div>
        <SiteFooter />
      </>
    );
  }

  if (isError || !business) {
    return (
      <>
        <Navbar />
        <div className="bd-state-page">
          <p>We couldn't load this business.</p>
          <Link to="/" className="bd-back-link"><ArrowLeft size={14} /> Back to directory</Link>
        </div>
        <SiteFooter />
      </>
    );
  }

  const tags = business.tags
    ? business.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  let socialLinks = [];
  if (business.social_links) {
    try {
      const p = JSON.parse(business.social_links);
      if (p && typeof p === "object") socialLinks = Object.entries(p);
    } catch { /* ignore */ }
  }

  return (
    <>
      <Navbar />
      <main className="bd-page">
        <HeroGallery
          images={business.image_urls || []}
          logoUrl={business.logo_url}
          name={business.name}
          avgRating={business.avg_rating}
          reviewCount={business.review_count}
          isVerified={business.is_verified}
          shortDesc={business.short_description}
        />
        <div className="bd-body-wrap">
          <div className="bd-body">
            <div className="bd-main">
              <ReviewsSection websiteId={websiteId} />
            </div>
            <Sidebar business={business} tags={tags} socialLinks={socialLinks} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export default BusinessDetail;
