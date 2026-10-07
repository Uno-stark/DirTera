import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader, Plus, Star, X } from "lucide-react";
import api from "../../api/client";
import { fetchMyListings, fetchPlans, fetchSubscriptions, keys } from "../../api/queries";
import PaymentHealth from "../../components/PaymentHealth";
import ListingForm from "./ListingForm";
import { fmtDate, isExpiringSoon } from "../../utils/format";
import "../../styles/dashboard.css";

// ── Export popup ──────────────────────────────────────────────────────────────
function ExportModal({ listings, initialId, onClose }) {
  const [selectedId, setSelectedId] = useState(
    initialId && listings.some((l) => l.id === initialId) ? initialId : (listings[0]?.id ?? "")
  );
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState("");
  const [done,        setDone]        = useState(false);

  const handleExport = async () => {
    if (!selectedId) return;
    setExporting(true);
    setExportError("");
    setDone(false);
    try {
      const res = await api.get(`/api/v1/analytics/${selectedId}/export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = Object.assign(document.createElement("a"), {
        href: url, download: `clicks_${selectedId}.csv`,
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="db-modal-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <div className="db-modal" onClick={(e) => e.stopPropagation()}>
        <div className="db-modal-header">
          <div>
            <h2>Export click data</h2>
            <p>Download as CSV</p>
          </div>
          <button className="db-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="db-modal-body">
          <div className="db-modal-field">
            <label htmlFor="export-listing">Listing</label>
            <select
              id="export-listing"
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setDone(false); }}
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {exportError && (
            <p className="db-modal-error" role="alert">{exportError}</p>
          )}
          {done && (
            <p className="db-modal-success">Download started.</p>
          )}
        </div>

        <div className="db-modal-footer">
          <button className="db-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="db-btn-primary"
            onClick={handleExport}
            disabled={exporting || !selectedId}
          >
            {exporting
              ? <><Loader size={13} className="db-spin" /> Exporting…</>
              : <><Download size={13} /> Download CSV</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Star row ──────────────────────────────────────────────────────────────────
function StarRow({ value }) {
  const full  = Math.round(value);
  const empty = 5 - full;
  return (
    <span className="db-stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: full  }).map((_, i) => (
        <Star key={`f${i}`} size={11} fill="currentColor" strokeWidth={0} className="db-star-filled" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={11} fill="none" strokeWidth={1.5} className="db-star-empty" />
      ))}
      <span className="db-star-score">{value.toFixed(1)}</span>
    </span>
  );
}

// ── Listing row ───────────────────────────────────────────────────────────────
const STATUS_DOT = {
  approved:  "#22c55e",
  pending:   "#f59e0b",
  rejected:  "#ef4444",
  suspended: "#9ca3af",
};

function DescriptionText({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  // Approximate: if longer than ~100 chars it likely wraps to 2+ lines
  const isLong = text.length > 100;
  return (
    <p className="db-row-desc">
      {expanded || !isLong ? text : `${text.slice(0, 100)}…`}
      {isLong && (
        <button
          type="button"
          className="db-row-desc-toggle"
          onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </p>
  );
}

function ListingRow({ listing, index, onEdit, onExport }) {
  const dotColor = STATUS_DOT[listing.status] ?? "#9ca3af";

  return (
    <div className="db-row">
      <span className="db-row-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Logo with status dot in top-right corner */}
      <div className="db-row-logo-wrap">
        <div className="db-row-logo">
          {listing.logo_url ? (
            <img src={listing.logo_url} alt="" loading="lazy" />
          ) : (
            <span className="db-row-logo-placeholder" aria-hidden="true">
              {listing.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span
          className="db-row-dot"
          style={{ background: dotColor }}
          title={listing.status}
          aria-label={`Status: ${listing.status}`}
        />
      </div>

      <div className="db-row-info">
        <div className="db-row-name-row">
          <Link to={`/businesses/${listing.id}`} className="db-row-name">
            {listing.name}
          </Link>
          {listing.is_premiered && (
            <span className="db-row-premiered">Premier</span>
          )}
        </div>
        <div className="db-row-meta">
          {listing.avg_rating > 0 && <StarRow value={listing.avg_rating} />}
          {listing.total_clicks > 0 && (
            <span className="db-meta-text">{listing.total_clicks} clicks</span>
          )}
          {listing.domain_slug && (
            <span className="db-meta-chip">
              {listing.domain_slug.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <DescriptionText text={listing.short_description} />
      </div>

      <div className="db-row-actions">
        {listing.status === "approved" && (
          <button className="db-btn-ghost" onClick={() => onExport(listing.id)}>
            Export
          </button>
        )}
        {listing.status === "approved" && (
          <Link to={`/subscribe/${listing.id}`} className="db-btn-ghost">
            Subscribe
          </Link>
        )}
        <button className="db-btn-ghost" onClick={() => onEdit(listing.id)}>
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ListingSkeleton() {
  return (
    <div className="db-list">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="db-skeleton" />
      ))}
    </div>
  );
}

// ── Subscriptions section ─────────────────────────────────────────────────────
function SubscriptionsSection() {
  const [open, setOpen] = useState(false);

  const { data: subs = [], isLoading, isError } = useQuery({
    queryKey: keys.subscriptions(),
    queryFn:  fetchSubscriptions,
    staleTime: 60_000,
  });

  // Fetch all available plans so we can show "upgrade" button
  const { data: plans = [] } = useQuery({
    queryKey: keys.plans(),
    queryFn:  fetchPlans,
    staleTime: 5 * 60_000,
  });

  const activeCount = subs.filter((s) => s.status === "active").length;
  const expiringAny = subs.some((s) => isExpiringSoon(s.expires_at));

  // Build plan order by amount ascending so we know which is "next"
  const planOrder = [...plans].sort((a, b) => Number(a.amount) - Number(b.amount));

  const nextPlan = (currentPlanSlug) => {
    const idx = planOrder.findIndex((p) => p.slug === currentPlanSlug);
    return idx >= 0 && idx < planOrder.length - 1 ? planOrder[idx + 1] : null;
  };

  return (
    <section className="db-subs-section">
      <button
        type="button"
        className="db-subs-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="db-subs-toggle-label">
          Subscriptions
          {!isLoading && subs.length > 0 && (
            <span className="db-subs-meta">
              {activeCount} active
              {expiringAny && <span className="db-subs-warn"> · expiring soon</span>}
            </span>
          )}
        </span>
        <span className="db-subs-toggle-icon">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="db-subs-body">
          {/* Payment service health */}
          <div className="db-subs-health">
            <PaymentHealth />
            <span className="db-subs-health-label">Payment service</span>
          </div>

          {isLoading  && <p className="db-subs-state">Loading…</p>}
          {!isLoading && isError && (
            <p className="db-subs-state db-subs-error">Couldn't load subscriptions.</p>
          )}
          {!isLoading && !isError && subs.length === 0 && (
            <p className="db-subs-state">No subscriptions yet.</p>
          )}

          {!isLoading && !isError && subs.length > 0 && (
            <div className="db-subs-cards">
              {subs.map((sub) => {
                const isActive   = sub.status === "active";
                const isExpired  = sub.status === "expired";
                const expiring   = isExpiringSoon(sub.expires_at);
                const upgrade    = nextPlan(sub.plan);
                const canUpgrade = isActive && Boolean(upgrade);
                const canRenew   = isExpired || expiring;

                return (
                  <div
                    key={sub.id}
                    className={`db-sub-card${expiring ? " db-sub-card--warn" : ""}${isExpired ? " db-sub-card--expired" : ""}`}
                  >
                    <div className="db-sub-card-main">
                      <div className="db-sub-card-info">
                        <span className="db-sub-card-name">{sub.website_name ?? "Listing"}</span>
                        <span className="db-sub-card-plan">
                          {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} plan
                        </span>
                      </div>
                      <div className="db-sub-card-meta">
                        <span className="db-sub-card-dates">
                          {fmtDate(sub.starts_at)} → {fmtDate(sub.expires_at)}
                        </span>
                        {expiring && (
                          <span className="db-sub-card-expiring">Expiring soon</span>
                        )}
                      </div>
                    </div>

                    <div className="db-sub-card-actions">
                      {canRenew && (
                        <Link
                          to={`/subscribe/${sub.website_id}`}
                          className="db-sub-card-btn"
                        >
                          {isExpired ? "Resubscribe" : "Renew"}
                        </Link>
                      )}
                      {canUpgrade && (
                        <Link
                          to={`/subscribe/${sub.website_id}`}
                          className="db-sub-card-btn db-sub-card-btn--upgrade"
                        >
                          Upgrade to {upgrade.label}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const queryClient = useQueryClient();

  const [formOpen,      setFormOpen]      = useState(false);
  const [editWebsiteId, setEditWebsiteId] = useState(null);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportId,      setExportId]      = useState(null);

  const openCreate  = () => { setEditWebsiteId(null); setFormOpen(true); };
  const openEdit    = (id) => { setEditWebsiteId(id); setFormOpen(true); };
  const openExport  = (id) => { setExportId(id); setExportOpen(true); };
  const closeForm   = () => {
    setFormOpen(false);
    setEditWebsiteId(null);
    queryClient.invalidateQueries({ queryKey: keys.myListings() });
  };

  const { data: listingsData, isLoading, isError } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 60_000,
  });

  const listings      = listingsData?.items ?? [];
  const approvedList  = listings.filter((l) => l.status === "approved");
  const pendingCount  = listings.filter((l) => l.status === "pending").length;
  const approvedCount = approvedList.length;
  const rejectedCount = listings.filter((l) => l.status === "rejected").length;

  return (
    <>
      <ListingForm isOpen={formOpen} onClose={closeForm} websiteId={editWebsiteId} />

      {exportOpen && (
        <ExportModal
          listings={approvedList}
          initialId={exportId}
          onClose={() => { setExportOpen(false); setExportId(null); }}
        />
      )}

      <main className="db-page">
        <header className="db-header">
          <Link to="/" className="db-back-link">
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back to home
          </Link>
          <h1>My Dashboard</h1>
          <p>Manage your website listings and track their performance.</p>
        </header>

        <div className="db-body">
          {/* Stats */}
          <div className="db-stats">
            <div className="db-stat"><span>Total</span><strong>{listings.length}</strong></div>
            <div className="db-stat">
              <span><span className="db-stat-dot" style={{background:"#22c55e"}} />Approved</span>
              <strong>{approvedCount}</strong>
            </div>
            <div className="db-stat">
              <span><span className="db-stat-dot" style={{background:"#f59e0b"}} />Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="db-stat">
              <span><span className="db-stat-dot" style={{background:"#ef4444"}} />Rejected</span>
              <strong>{rejectedCount}</strong>
            </div>
          </div>

          {/* Listings */}
          <section className="db-section">
            <div className="db-toolbar">
              <div className="db-toolbar-left">
                <h2 className="db-toolbar-heading">My listings</h2>
              </div>
              <button className="db-btn-add" onClick={openCreate}>
                <Plus size={14} strokeWidth={2.5} />
                Add listing
              </button>
            </div>

            {isLoading && <ListingSkeleton />}
            {!isLoading && isError && (
              <div className="db-error" role="alert">Couldn't load your listings.</div>
            )}
            {!isLoading && !isError && listings.length === 0 && (
              <div className="db-empty">
                <p>No listings yet. Use the button above to add your first website.</p>
              </div>
            )}
            {!isLoading && !isError && listings.length > 0 && (
              <div className="db-list">
                {listings.map((listing, i) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    index={i}
                    onEdit={openEdit}
                    onExport={openExport}
                  />
                ))}
              </div>
            )}
          </section>

          <SubscriptionsSection />
        </div>
      </main>
    </>
  );
}

export default Dashboard;
