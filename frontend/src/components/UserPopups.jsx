/**
 * UserPopups — three minimal portal popups triggered from UserMenu:
 *   <ExportPopup>        — pick a listing, download CSV
 *   <SubscriptionsPopup> — view subs (name · plan · action button)
 *   <SubscribePopup>     — pick a listing → navigate to /subscribe/:id
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader, X, CreditCard, ExternalLink } from "lucide-react";
import api from "../api/client";
import {
  fetchMyListings,
  fetchSubscriptions,
  fetchPlans,
  keys,
} from "../api/queries";
import { fmtDate, isExpiringSoon } from "../utils/format";

// ── Shared: centred modal shell ───────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="up-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="up-modal" onClick={(e) => e.stopPropagation()}>
        <div className="up-modal-header">
          <span className="up-modal-title">{title}</span>
          <button
            type="button"
            className="up-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="up-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ── 1. Export Analytics popup ─────────────────────────────────────────────────
export function ExportPopup({ onClose }) {
  const { data: listingsData, isLoading, isError } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 60_000,
  });

  const approved = (listingsData?.items ?? []).filter((l) => l.status === "approved");

  const [selectedId, setSelectedId] = useState(() =>
    listingsData?.items?.find((l) => l.status === "approved")?.id ?? ""
  );
  const [exporting, setExporting] = useState(false);
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);

  // Pre-select once data arrives
  useEffect(() => {
    if (!selectedId && approved.length > 0) setSelectedId(approved[0].id);
  }, [approved, selectedId]);

  const handleExport = async () => {
    if (!selectedId) return;
    setExporting(true);
    setError("");
    setDone(false);
    try {
      const res = await api.get(`/api/v1/analytics/${selectedId}/export`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = Object.assign(document.createElement("a"), {
        href: url,
        download: `clicks_${selectedId}.csv`,
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal title="Export Analytics" onClose={onClose}>
      {isLoading && (
        <div className="up-state">
          <Loader size={16} className="up-spin" /> Loading listings…
        </div>
      )}

      {!isLoading && isError && (
        <p className="up-error">Couldn't load listings.</p>
      )}

      {!isLoading && !isError && approved.length === 0 && (
        <p className="up-empty">No approved listings to export yet.</p>
      )}

      {!isLoading && !isError && approved.length > 0 && (
        <>
          <div className="up-field">
            <label htmlFor="up-export-sel">Listing</label>
            <select
              id="up-export-sel"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setDone(false);
                setError("");
              }}
            >
              {approved.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="up-error">{error}</p>}
          {done  && <p className="up-success">Download started.</p>}

          <div className="up-actions">
            <button
              type="button"
              className="up-btn-primary"
              onClick={handleExport}
              disabled={exporting || !selectedId}
            >
              {exporting
                ? <><Loader size={13} className="up-spin" /> Exporting…</>
                : <><Download size={13} /> Download CSV</>}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── 2. Subscriptions popup ────────────────────────────────────────────────────
export function SubscriptionsPopup({ onClose }) {
  const navigate = useNavigate();

  const { data: subs = [], isLoading, isError } = useQuery({
    queryKey: keys.subscriptions(),
    queryFn:  fetchSubscriptions,
    staleTime: 60_000,
  });

  const { data: plans = [] } = useQuery({
    queryKey: keys.plans(),
    queryFn:  fetchPlans,
    staleTime: 5 * 60_000,
  });

  const planOrder = [...plans].sort((a, b) => Number(a.amount) - Number(b.amount));

  const nextPlan = (slug) => {
    const idx = planOrder.findIndex((p) => p.slug === slug);
    return idx >= 0 && idx < planOrder.length - 1 ? planOrder[idx + 1] : null;
  };

  const go = (websiteId) => { onClose(); navigate(`/subscribe/${websiteId}`); };

  return (
    <Modal title="My Subscriptions" onClose={onClose}>
      {isLoading && (
        <div className="up-state">
          <Loader size={16} className="up-spin" /> Loading…
        </div>
      )}

      {!isLoading && isError && (
        <p className="up-error">Couldn't load subscriptions.</p>
      )}

      {!isLoading && !isError && subs.length === 0 && (
        <div className="up-empty-block">
          <CreditCard size={28} strokeWidth={1.5} className="up-empty-icon" />
          <p>No subscriptions yet.</p>
          <p className="up-empty-hint">Go to your dashboard and click Subscribe on an approved listing.</p>
        </div>
      )}

      {!isLoading && !isError && subs.length > 0 && (
        <ul className="up-sub-list">
          {subs.map((sub) => {
            const isExpired  = sub.status === "expired";
            const expiring   = isExpiringSoon(sub.expires_at);
            const upgrade    = nextPlan(sub.plan);
            const canUpgrade = sub.status === "active" && Boolean(upgrade);
            const canRenew   = isExpired || expiring;
            const actionLabel = isExpired ? "Resubscribe" : expiring ? "Renew" : canUpgrade ? `Upgrade → ${upgrade.label}` : null;

            return (
              <li key={sub.id} className={`up-sub-row${expiring ? " up-sub-row--warn" : ""}${isExpired ? " up-sub-row--expired" : ""}`}>
                <div className="up-sub-info">
                  <span className="up-sub-name">{sub.website_name ?? "Listing"}</span>
                  <span className="up-sub-plan">
                    {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                    {" · "}
                    <span className="up-sub-dates">
                      {fmtDate(sub.starts_at)} – {fmtDate(sub.expires_at)}
                    </span>
                  </span>
                </div>
                {(canRenew || canUpgrade) && actionLabel && (
                  <button
                    type="button"
                    className={`up-sub-btn${canUpgrade && !canRenew ? " up-sub-btn--upgrade" : ""}`}
                    onClick={() => go(sub.website_id)}
                  >
                    {actionLabel}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

// ── 3. Subscribe (pick listing) popup ─────────────────────────────────────────
export function SubscribePopup({ onClose }) {
  const navigate = useNavigate();

  const { data: listingsData, isLoading, isError } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 60_000,
  });

  const approved = (listingsData?.items ?? []).filter((l) => l.status === "approved");

  const go = (id) => { onClose(); navigate(`/subscribe/${id}`); };

  return (
    <Modal title="Subscribe" onClose={onClose}>
      {isLoading && (
        <div className="up-state">
          <Loader size={16} className="up-spin" /> Loading listings…
        </div>
      )}

      {!isLoading && isError && (
        <p className="up-error">Couldn't load listings.</p>
      )}

      {!isLoading && !isError && approved.length === 0 && (
        <div className="up-empty-block">
          <p>No approved listings available to subscribe.</p>
          <p className="up-empty-hint">A listing must be approved before you can subscribe to a plan.</p>
        </div>
      )}

      {!isLoading && !isError && approved.length > 0 && (
        <>
          <p className="up-hint">Pick a listing to view and select a plan.</p>
          <ul className="up-sub-list">
            {approved.map((l) => (
              <li key={l.id} className="up-sub-row">
                <div className="up-sub-info">
                  <span className="up-sub-name">{l.name}</span>
                  {l.domain_slug && (
                    <span className="up-sub-plan">{l.domain_slug.replace(/_/g, " ")}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="up-sub-btn"
                  onClick={() => go(l.id)}
                >
                  <ExternalLink size={12} />
                  Subscribe
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
