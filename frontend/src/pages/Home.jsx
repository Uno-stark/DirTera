import { useState, useEffect, useRef, useCallback, memo } from "react";

import { Link, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { fetchFeatured, fetchTopWebsites, fetchWebsites, keys } from "../api/queries";
import Navbar from "../components/Navbar";
import BusinessCard from "../components/BusinessCard";
import { ResponsiveImage } from "../components/BusinessCard";
import Stars from "../components/Stars";
import SiteFooter from "../components/SiteFooter";

import { ctaBg } from "../assets/home/images.js";
import heroSlides from "../assets/home/hero-slides.json";

import cateringWebp from "../assets/home/catering.webp";
import serverWebp   from "../assets/home/server.webp";
import gymWebp      from "../assets/home/gym.webp";
import carsWebp     from "../assets/home/cars.webp";

import "../styles/home.css";

const IMAGE_MAP = {
  "catering.webp": cateringWebp,
  "server.webp":   serverWebp,
  "gym.webp":      gymWebp,
  "cars.webp":     carsWebp,
};

function resolveImage(filename) {
  return IMAGE_MAP[filename] ?? cateringWebp;
}

// ── Animated hero ─────────────────────────────────────────────────────────────
function useHeroSlide() {
  const [active,  setActive]  = useState(0);
  const [visible, setVisible] = useState(true);
  const total = heroSlides.length;

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActive((i) => (i + 1) % total);
        setVisible(true);
      }, 350);
    }, 9000);
    return () => clearInterval(id);
  }, [total]);

  return { active, visible };
}

function HeroBgTrack({ active }) {
  return (
    <div className="hero-bg-track" aria-hidden="true">
      {heroSlides.map((s, i) => (
        <div
          key={i}
          className={`hero-bg-slide${i === active ? " active" : ""}`}
          style={{ backgroundImage: `url(${resolveImage(s.image)})` }}
        />
      ))}
      <div className="hero-overlay" />
    </div>
  );
}

function Hero({ active, visible }) {
  const slide = heroSlides[active];
  return (
    <section className="hero">
      <div
        className={`hero-content${visible ? " hero-content-visible" : ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {slide.label && <p className="hero-label">{slide.label}</p>}
        <h1>
          {slide.heading.split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
        </h1>
        {slide.sub && <p className="hero-sub">{slide.sub}</p>}
      </div>
    </section>
  );
}

// ── Featured card ─────────────────────────────────────────────────────────────
const WORD_LIMIT = 15;

function truncate(text) {
  const words = text.trim().split(/\s+/);
  if (words.length <= WORD_LIMIT) return { short: text, needsMore: false };
  return { short: words.slice(0, WORD_LIMIT).join(" "), needsMore: true };
}

function FeaturedCard({ business }) {
  const [expanded, setExpanded] = useState(false);
  const { short, needsMore } = truncate(business.short_description || "");

  return (
    <Link to={`/businesses/${business.id}`} className="featured-card">
      <div className="featured-card-image">
        {business.image_urls?.[0] ? (
          <ResponsiveImage src={business.image_urls[0]} alt="" loading="lazy" />
        ) : (
          <div className="featured-card-placeholder" />
        )}
        {business.domain_slug && (
          <span className="featured-card-tag">
            {business.domain_slug.replace(/_/g, " ")}
          </span>
        )}
        
      </div>

      <div className="featured-card-body">
        {business.avg_rating > 0 && (
          <div className="featured-card-rating">
            <Stars value={business.avg_rating} />
            <span className="rating-num">{business.avg_rating.toFixed(1)}</span>
            {business.review_count > 0 && (
              <span className="rating-count">({business.review_count})</span>
            )}
            {business.category_slug && (
              <span className="featured-card-location">
                {business.category_slug.replace(/_/g, " ")}
              </span>
            )}
          </div>
        )}
        <h3>{business.name}</h3>

        {business.short_description && (
          <p className="featured-card-desc">
            {expanded ? business.short_description : short}
            {needsMore && !expanded && "… "}
            {needsMore && (
              <button
                type="button"
                className="featured-card-readmore"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        )}

        <span className="featured-card-read">
          View listing <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

// ── Featured carousel hook ─────────────────────────────────────────────────────
// Uses CSS animation for the auto-scroll (no DOM duplication needed).
// Pauses on hover/touch. Supports drag-to-scroll (pauses animation while dragging).
function useFeaturedCarousel() {
  const trackRef  = useRef(null);
  const pausedRef = useRef(false);
  const dragRef   = useRef({ active: false, startX: 0, scrollLeft: 0 });

  // Pause/resume CSS animation
  const setCSSPause = (paused) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.animationPlayState = paused ? "paused" : "running";
  };

  const pause = useCallback(() => {
    pausedRef.current = true;
    setCSSPause(true);
  }, []);

  const resume = useCallback(() => {
    if (dragRef.current.active) return; // don't resume mid-drag
    pausedRef.current = false;
    setCSSPause(false);
  }, []);

  const onMouseDown = useCallback((e) => {
    const el = trackRef.current; if (!el) return;
    el.style.animationPlayState = "paused";
    dragRef.current = {
      active: true,
      startX: e.pageX,
      parentScroll: el.parentElement?.scrollLeft ?? 0,
    };
    el.style.cursor = "grabbing";
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const el = trackRef.current; if (!el) return;
    const parent = el.parentElement;
    if (parent) {
      const delta = dragRef.current.startX - e.pageX;
      parent.scrollLeft = (dragRef.current.parentScroll ?? 0) + delta;
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.active = false;
    if (trackRef.current) trackRef.current.style.cursor = "grab";
    if (!pausedRef.current) setCSSPause(false);
  }, []);

  const onTouchStart = useCallback((e) => {
    pause();
    dragRef.current = {
      active: true,
      startX: e.touches[0].pageX,
      parentScroll: trackRef.current?.parentElement?.scrollLeft ?? 0,
    };
  }, [pause]);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const parent = trackRef.current?.parentElement;
    if (parent) {
      const delta = dragRef.current.startX - e.touches[0].pageX;
      parent.scrollLeft = (dragRef.current.parentScroll ?? 0) + delta;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    dragRef.current.active = false;
    resume();
  }, [resume]);

  return {
    trackRef,
    handlers: {
      onMouseEnter: pause,
      onMouseLeave: resume,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}

// ── Ticker item ───────────────────────────────────────────────────────────────
const TickerItem = memo(function TickerItem({ business }) {
  return (
    <Link to={`/businesses/${business.id}`} className="ticker-item">
      {business.avg_rating > 0 && (
        <>
          <Stars value={business.avg_rating} size={11} />
          <span className="ticker-score">{business.avg_rating.toFixed(1)}</span>
        </>
      )}
      <span className="ticker-name">{business.name}</span>
      {business.category_slug && (
        <span className="ticker-location">
          {business.category_slug.replace(/_/g, " ")}
        </span>
      )}
    </Link>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
function Home() {
  const [searchParams]  = useSearchParams();
  const location        = useLocation();
  const navigate        = useNavigate();
  const [browsingPage, setBrowsingPage] = useState(1);

  const activeSearch = searchParams.get("search") || "";

  const { active: heroActive, visible: heroVisible } = useHeroSlide();

  useEffect(() => { setBrowsingPage(1); }, [activeSearch]);

  // Fetch more premiered listings so the carousel has content to scroll through
  const featuredParams = { page: 1, page_size: 12, sort_by: "score" };
  const topParams      = { limit: 16, sort_by: "rating" };

  const { data: featuredData, isLoading: isLoadingFeatured } = useQuery({
    queryKey: keys.premiered(featuredParams),
    queryFn:  () => fetchFeatured(featuredParams),
  });

  const { data: topData } = useQuery({
    queryKey: keys.topWebsites(topParams),
    queryFn:  () => fetchTopWebsites(topParams),
  });

  const featured = featuredData?.items ?? [];
  const topRated = (topData?.items ?? []).filter((b) => b.avg_rating >= 3);

  const searchParams_ = {
    page: browsingPage, page_size: 9, sort_by: "score", keywords: activeSearch,
  };

  const { data: searchData, isLoading: isLoadingBrowsing } = useQuery({
    queryKey: keys.websites(searchParams_),
    queryFn:  () => fetchWebsites(searchParams_),
    enabled:  Boolean(activeSearch),
  });

  const browsing      = searchData?.items       ?? [];
  const browsingTotal = searchData?.total_pages ?? 1;
  const showSearch    = Boolean(activeSearch);

  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  // Only animate + duplicate when cards overflow the viewport (more than 3)
  const ANIMATE_THRESHOLD = 3;
  const shouldAnimate  = featured.length > ANIMATE_THRESHOLD;
  // For seamless CSS loop we need 2 sets in the DOM
  const carouselItems  = shouldAnimate ? [...featured, ...featured] : featured;

  const { trackRef, handlers } = useFeaturedCarousel();

  return (
    <main className="home-main">
        <div className="hero-shell">
          <HeroBgTrack active={heroActive} />
          <Navbar />
          <Hero active={heroActive} visible={heroVisible} />
        </div>

        {showSearch ? (
          <section className="section browse-section">
            <div className="home-container">
              <div className="section-header">
                <div>
                  <h2>Results for &ldquo;{activeSearch}&rdquo;</h2>
                  {browsingTotal > 0 && <p>Page {browsingPage} of {browsingTotal}</p>}
                </div>
                <Link to="/" className="view-all-link">Clear search</Link>
              </div>

              {isLoadingBrowsing ? (
                <div className="browse-skeleton">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className="skeleton-card skeleton-card-sm" />
                  ))}
                </div>
              ) : browsing.length === 0 ? (
                <p className="empty-note">No businesses found. Try a different search.</p>
              ) : (
                <>
                  <div className="browse-grid">
                    {browsing.map((b) => <BusinessCard key={b.id} business={b} />)}
                  </div>
                  {browsingTotal > 1 && (
                    <div className="pagination">
                      <button type="button" className="pagination-button"
                        disabled={browsingPage === 1}
                        onClick={() => setBrowsingPage((p) => p - 1)}>
                        Previous
                      </button>
                      <span className="pagination-info">
                        Page {browsingPage} of {browsingTotal}
                      </span>
                      <button type="button" className="pagination-button"
                        disabled={browsingPage === browsingTotal}
                        onClick={() => setBrowsingPage((p) => p + 1)}>
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* ── Featured carousel ──────────────────────────────────────── */}
            <section className="featured-section">
              <div className="home-container">
                <div className="section-header">
                  <div>
                    <h2>Premiered businesses</h2>
                    <p>
                      Independent places chosen for their craft, character, and
                      consistently generous experience.
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingFeatured ? (
                <div className="featured-skeleton-row">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="skeleton-card featured-skeleton-item" />
                  ))}
                </div>
              ) : featured.length === 0 ? (
                <div className="home-container">
                  <p className="empty-note">No featured listings yet. Check back soon.</p>
                </div>
              ) : (
                <div className="featured-carousel-viewport">
                  <div
                    ref={trackRef}
                    className={`featured-carousel${shouldAnimate ? " featured-carousel--scroll" : ""}`}
                    {...handlers}
                    aria-label="Featured businesses carousel"
                  >
                    {carouselItems.map((b, i) => (
                      <div key={`${b.id}-${i}`} className="featured-carousel-item">
                        <FeaturedCard business={b} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {topRated.length > 0 && (
              <section className="ticker-section">
                <div className="home-container">
                  <div className="ticker-header">
                    <div><h2>Top rated sites</h2></div>
                    <p className="ticker-description">
                      The places earning exceptional reviews from the Index community, right now.
                    </p>
                  </div>
                </div>
                <div className="ticker-rows">
                  {[topRated.slice(0, 8), topRated.slice(8, 16)].map((row, ri) => {
                    // Only duplicate when there are enough items to fill the row
                    const trackItems = row.length > 4 ? [...row, ...row] : row;
                    return (
                      <div key={ri} className="ticker-row">
                        <div className={`ticker-track${ri === 1 ? " ticker-track-reverse" : ""}`}>
                          {trackItems.map((b, i) => (
                            <TickerItem key={`${b.id}-${i}`} business={b} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="cta-section">
              <div className="cta-inner">
                <div className="cta-text">
                  <p className="cta-eyebrow">For business owners</p>
                  <h2>Own a place people should know?</h2>
                  <p>
                    Register your business, share what makes your business
                    distinct, and build trust with thoughtful reviews.
                  </p>
                  <button type="button" className="cta-button" onClick={() => goModal("/login")}>
                    Register your business
                    <ArrowUpRight size={13} className="cta-button-icon" />
                  </button>
                </div>
                <div className="cta-image" aria-hidden="true"
                  style={{ backgroundImage: `url(${ctaBg})` }} />
              </div>
            </section>
          </>
        )}

        <SiteFooter />
      </main>
  );
}

export default Home;
