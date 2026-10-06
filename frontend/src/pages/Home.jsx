import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import api from "../api/client";
import Navbar from "../components/Navbar";
import BusinessCard from "../components/BusinessCard";
import {
  Star,
  ArrowUpRight,
  ArrowRight,
  BarChart2,
} from "lucide-react";

import { heroBg, ctaBg } from "../assets/home/images.js";

import "../styles/home.css";

// ── Star rating display 
function Stars({ value, size = 13 }) {
  const full  = Math.round(value);
  const empty = 5 - full;
  return (
    <span className="star-row" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star
          key={`f${i}`}
          size={size}
          className="star star-filled"
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star
          key={`e${i}`}
          size={size}
          className="star star-empty"
          fill="none"
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ── Featured card 
function FeaturedCard({ business }) {
  return (
    <Link to={`/businesses/${business.id}`} className="featured-card">
      <div className="featured-card-image">
        {business.image_urls?.[0] ? (
          <img src={business.image_urls[0]} alt="" loading="lazy" />
        ) : (
          <div className="featured-card-placeholder" />
        )}
        {business.domain_slug && (
          <span className="featured-card-tag">
            {business.domain_slug.replace(/_/g, " ")}
          </span>
        )}
        {business.is_premiered && (
          <span className="featured-card-tag featured-card-tag-premier">Premier</span>
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
        <p>{business.short_description}</p>

        <span className="featured-card-read">
          Read more <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}

// ── Ticker item 
function TickerItem({ business }) {
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
}

// ── Main component 
function Home() {
  const [searchParams]  = useSearchParams();
  const location        = useLocation();
  const navigate        = useNavigate();

  const [featured,    setFeatured]    = useState([]);
  const [topRated,    setTopRated]    = useState([]);
  const [browsing,    setBrowsing]    = useState([]);
  const [browsingTotal, setBrowsingTotal] = useState(0);
  const [browsingPage,  setBrowsingPage]  = useState(1);
  const [isLoadingFeatured,  setIsLoadingFeatured]  = useState(true);
  const [isLoadingBrowsing,  setIsLoadingBrowsing]  = useState(true);

  const browseRef = useRef(null);
  const activeCat    = searchParams.get("category") || "";
  const activeSearch = searchParams.get("search")   || "";

  // Featured + top-rated — loaded once
  useEffect(() => {
    const load = async () => {
      setIsLoadingFeatured(true);
      try {
        const [featuredRes, topRes] = await Promise.all([
          api.get("/api/v1/websites/premiered", {
            params: { page: 1, page_size: 3, sort_by: "score" },
          }),
          api.get("/api/v1/websites/top", {
            params: { limit: 16, sort_by: "rating" },
          }),
        ]);
        setFeatured(featuredRes.data.items || []);
        setTopRated(topRes.data.items     || []);
      } catch {
        // non-fatal
      } finally {
        setIsLoadingFeatured(false);
      }
    };
    load();
  }, []);

  // Reset page when filter changes
  useEffect(() => { setBrowsingPage(1); }, [activeCat, activeSearch]);

  // Browse results
  useEffect(() => {
    const load = async () => {
      setIsLoadingBrowsing(true);
      try {
        const { data } = await api.get("/api/v1/websites", {
          params: {
            page: browsingPage,
            page_size: 9,
            sort_by: "score",
            ...(activeCat    && { category: activeCat }),
            ...(activeSearch && { keywords: activeSearch }),
          },
        });
        setBrowsing(data.items || []);
        setBrowsingTotal(data.total_pages || 1);
      } catch {
        setBrowsing([]);
      } finally {
        setIsLoadingBrowsing(false);
      }
    };
    load();
  }, [browsingPage, activeCat, activeSearch]);

  const showBrowse = Boolean(activeCat || activeSearch || browsingPage > 1);

  // Open the auth modal overlay on top of the current page
  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  return (
    <>
      <Navbar />

      <main className="home-main">

        {/*  Hero  */}
        <section className="hero" style={{ backgroundImage: `url(${heroBg})` }}>
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="hero-label">DirTera Business Directory</p>
            <h1>Find businesses and<br />services near you.</h1>
            <p className="hero-sub">
              Discover the people and places shaping every neighborhood.
            </p>
          </div>
        </section>

        {/*  Featured + Ticker + CTA  */}
        {!showBrowse && (
          <>
            {/* Featured */}
            <section className="section featured-section">
              <div className="home-container">
                <div className="section-header">
                  <div>
                    <h2>Featured businesses</h2>
                    <p>
                      Independent places chosen for their craft, character, and
                      consistently generous experience.
                    </p>
                  </div>
                  <Link to="/" className="view-all-link">
                    View all businesses
                    <ArrowUpRight size={13} className="view-all-icon" />
                  </Link>
                </div>

                {isLoadingFeatured ? (
                  <div className="featured-skeleton">
                    {[1, 2, 3].map((i) => <div key={i} className="skeleton-card" />)}
                  </div>
                ) : featured.length > 0 ? (
                  <div className="featured-grid">
                    {featured.map((b) => <FeaturedCard key={b.id} business={b} />)}
                  </div>
                ) : (
                  <p className="empty-note">No featured listings yet. Check back soon.</p>
                )}
              </div>
            </section>

            {/* Top-rated ticker */}
            {topRated.length > 0 && (
              <section className="ticker-section">
                <div className="home-container">
                  <div className="ticker-header">
                    <div>
                      <p className="ticker-eyebrow">The Index, live</p>
                      <h2>Top rated sites</h2>
                    </div>
                    <p className="ticker-description">
                      The places earning exceptional reviews from the Index
                      community, right now.
                    </p>
                  </div>
                </div>

                <div className="ticker-rows">
                  {[topRated.slice(0, 8), topRated.slice(8, 16)].map((row, ri) => (
                    <div key={ri} className="ticker-row">
                      <div className={`ticker-track ${ri === 1 ? "ticker-track-reverse" : ""}`}>
                        {[...row, ...row].map((b, i) => (
                          <TickerItem key={`${b.id}-${i}`} business={b} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA banner */}
            <section className="cta-section">
              <div className="cta-inner">
                <div className="cta-text">
                  <p className="cta-eyebrow">For business owners</p>
                  <h2>Own a place people should know?</h2>
                  <p>
                    Register your business, share what makes your business
                    distinct, and build trust with thoughtful reviews.
                  </p>
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => goModal("/login")}
                  >
                    Register your business
                    <ArrowUpRight size={13} className="cta-button-icon" />
                  </button>
                </div>
                {/* CTA image */}
                <div
                  className="cta-image"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${ctaBg})` }}
                />
              </div>
            </section>
          </>
        )}

        {/* ── Browse results ────────────────────────────────────────── */}
        <div ref={browseRef} />

        {showBrowse && (
          <section className="section browse-section">
            <div className="home-container">
              <div className="section-header">
                <div>
                  <h2>
                    {activeSearch
                      ? `Results for "${activeSearch}"`
                      : activeCat
                        ? `${activeCat.replace(/_/g, " ")} businesses`
                        : "All businesses"}
                  </h2>
                  {browsingTotal > 0 && (
                    <p>Page {browsingPage} of {browsingTotal}</p>
                  )}
                </div>
                {(activeCat || activeSearch) && (
                  <Link to="/" className="view-all-link">Clear filter</Link>
                )}
              </div>

              {isLoadingBrowsing ? (
                <div className="browse-skeleton">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
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
                      <button
                        type="button"
                        className="pagination-button"
                        disabled={browsingPage === 1}
                        onClick={() => setBrowsingPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span className="pagination-info">
                        Page {browsingPage} of {browsingTotal}
                      </span>
                      <button
                        type="button"
                        className="pagination-button"
                        disabled={browsingPage === browsingTotal}
                        onClick={() => setBrowsingPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/*  Footer  */}
        <footer className="site-footer">
          <div className="home-container footer-inner">
            <div className="footer-brand">
              <Link to="/" className="footer-logo">
                <BarChart2
                  size={20}
                  className="footer-logo-icon"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                DirTera
              </Link>
              <p>A considered guide to the businesses<br />that make a place feel like itself.</p>
            </div>

            <div className="footer-links">
              <div className="footer-col">
                <p className="footer-col-heading">About</p>
                <a href="/api/v1/legal/terms"   target="_blank" rel="noreferrer" className="footer-link">Terms of Service</a>
                <a href="/api/v1/legal/privacy" target="_blank" rel="noreferrer" className="footer-link">Privacy Policy</a>
                <button type="button" className="footer-link footer-link-btn" onClick={() => goModal("/login")}>Contact</button>
              </div>
              <div className="footer-col">
                <p className="footer-col-heading">Business</p>
                <button type="button" className="footer-link footer-link-btn" onClick={() => goModal("/login")}>Register your business</button>
                <Link to="/dashboard" className="footer-link">Dashboard</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="home-container">
              <p>&copy; {new Date().getFullYear()} DirTera. Places, properly considered.</p>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}

export default Home;
