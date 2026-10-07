/**
 * UserPopups — portal popups triggered from UserMenu:
 *   <ExportPopup>        — pick a listing, download CSV
 *   <SubscriptionsPopup> — view subs; inline upgrade/renew via SubscribePlanModal
 *   <SubscribePopup>     — pick a listing → inline plan selection + payment
 *
 * SubscribePlanModal is the shared multi-step flow:
 *   step "listing"  — pick an approved listing (skipped when websiteId is pre-set)
 *   step "plans"    — select a plan card
 *   step "verify"   — paste receipt URL
 *   step "result"   — success or error
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Loader,
  Lock,
  X,
} from "lucide-react";
import api from "../api/client";
import {
  fetchMyListings,
  fetchSubscriptions,
  fetchPlans,
  fetchPaymentHealth,
  keys,
} from "../api/queries";
import PaymentHealth from "./PaymentHealth";
import { fmtDate, isExpiringSoon } from "../utils/format";

// ─────────────────────────────────────────────────────────────────────────────
// Shared modal shell
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

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
      <div className={`up-modal${wide ? " up-modal--wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="up-modal-header">
          <span className="up-modal-title">{title}</span>
          <button type="button" className="up-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="up-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Export Analytics popup
// ─────────────────────────────────────────────────────────────────────────────
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
        <div className="up-state"><Loader size={16} className="up-spin" /> Loading listings…</div>
      )}
      {!isLoading && isError && <p className="up-error">Couldn't load listings.</p>}
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
              onChange={(e) => { setSelectedId(e.target.value); setDone(false); setError(""); }}
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared: inline subscribe plan modal (multi-step)
// Steps: "listing" → "plans" → "verify" → "result"
// Pass initialWebsiteId to skip the listing-picker step.
// ─────────────────────────────────────────────────────────────────────────────
function parseFeatures(description) {
  if (!description) return [];
  return description.split(",").map((s) => s.trim()).filter(Boolean);
}

function PlanCard({ plan, selected, onClick, locked, current }) {
  const features = parseFeatures(plan.description);
  return (
    <button
      type="button"
      disabled={locked}
      className={[
        "up-plan-card",
        selected          ? "up-plan-card--selected" : "",
        plan.is_premiered ? "up-plan-card--featured"  : "",
        locked            ? "up-plan-card--locked"    : "",
        current           ? "up-plan-card--current"   : "",
      ].filter(Boolean).join(" ")}
      onClick={locked ? undefined : onClick}
      aria-disabled={locked}
    >
      {plan.is_premiered && !locked && (
        <span className="up-plan-tag up-plan-tag--featured">Premiered</span>
      )}
      {locked && (
        <span className="up-plan-tag up-plan-tag--locked">
          <Lock size={9} strokeWidth={2.5} />
          {current ? "Current plan" : "Not available"}
        </span>
      )}
      <div className="up-plan-top">
        <span className="up-plan-label">{plan.label}</span>
        <span className="up-plan-price">
          {Number(plan.amount).toLocaleString()}
          <small> {plan.currency}</small>
        </span>
      </div>
      <p className="up-plan-duration">{plan.duration_days} days</p>
      {features.length > 0 && (
        <ul className="up-plan-features">
          {features.map((f, i) => (
            <li key={i}>
              <Check size={12} strokeWidth={2.5} className="up-plan-check" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export function SubscribePlanModal({ onClose, initialWebsiteId = null }) {
  const queryClient = useQueryClient();

  // step: "listing" | "plans" | "verify" | "result"
  const [step,         setStep]         = useState(initialWebsiteId ? "plans" : "listing");
  const [websiteId,    setWebsiteId]    = useState(initialWebsiteId);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [receiptUrl,   setReceiptUrl]   = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError,  setVerifyError]  = useState("");

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: listingsData, isLoading: loadingListings, isError: listingsError } = useQuery({
    queryKey: keys.myListings(),
    queryFn:  fetchMyListings,
    staleTime: 60_000,
    enabled:  step === "listing",
  });
  const approved = (listingsData?.items ?? []).filter((l) => l.status === "approved");

  const { data: plans = [], isLoading: loadingPlans, isError: plansError } = useQuery({
    queryKey: keys.plans(),
    queryFn:  fetchPlans,
    staleTime: 5 * 60_000,
    enabled:  step === "plans",
  });

  const { data: allSubs = [] } = useQuery({
    queryKey: keys.subscriptions(),
    queryFn:  fetchSubscriptions,
    staleTime: 60_000,
    enabled:  step === "plans",
  });

  const { data: healthData } = useQuery({
    queryKey: keys.paymentHealth(),
    queryFn:  fetchPaymentHealth,
    staleTime: 2 * 60_000,
    retry: false,
    enabled: step === "verify",
  });
  const paymentOnline = healthData
    ? healthData.ok && healthData.components?.every((c) => c.status === "operational")
    : null;

  // ── plan lock logic ───────────────────────────────────────────────────────
  const planOrder = [...plans].sort((a, b) => Number(a.amount) - Number(b.amount));

  const activeSub = allSubs.find(
    (s) => s.website_id === websiteId &&
           (s.status === "active" || s.status === "pending")
  ) ?? null;

  const activeIdx      = activeSub ? planOrder.findIndex((p) => p.slug === activeSub.plan) : -1;
  const isPlanLocked   = (plan) => activeSub ? planOrder.findIndex((p) => p.slug === plan.slug) <= activeIdx : false;
  const isCurrentPlan  = (plan) => activeSub?.plan === plan.slug;

  // ── handlers ──────────────────────────────────────────────────────────────
  const pickListing = (id) => { setWebsiteId(id); setStep("plans"); };

  const pickPlan = (plan) => {
    if (isPlanLocked(plan)) return;
    setSelectedPlan(plan);
    setStep("verify");
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!receiptUrl.trim()) { setReceiptError("Please paste your receipt URL."); return; }
    setReceiptError("");
    setIsVerifying(true);
    try {
      const { data } = await api.post("/api/v1/payments/verify", {
        website_id:  websiteId,
        plan:        selectedPlan.slug,
        receipt_url: receiptUrl.trim(),
      });
      setVerifyResult(data);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409)      setVerifyError("This receipt has already been used.");
      else if (status === 503) setVerifyError("Payment service unavailable. Try again shortly.");
      else                     setVerifyError(typeof detail === "string" ? detail : "Couldn't verify payment. Check the receipt URL.");
    } finally {
      setIsVerifying(false);
      setStep("result");
    }
  };

  const handleRetry = () => {
    setReceiptUrl("");
    setReceiptError("");
    setVerifyError("");
    setStep("verify");
  };

  const handleDone = () => {
    queryClient.invalidateQueries({ queryKey: keys.subscriptions() });
    onClose();
  };

  // ── step title ────────────────────────────────────────────────────────────
  const titles = {
    listing: "Subscribe",
    plans:   "Choose a plan",
    verify:  "Verify payment",
    result:  verifyResult ? "Payment submitted" : "Verification failed",
  };

  return (
    <Modal title={titles[step]} onClose={onClose} wide={step === "plans"}>

      {/* ── Step: listing picker ───────────────────────────────────────── */}
      {step === "listing" && (
        <>
          {loadingListings && (
            <div className="up-state"><Loader size={16} className="up-spin" /> Loading listings…</div>
          )}
          {!loadingListings && listingsError && (
            <p className="up-error">Couldn't load listings.</p>
          )}
          {!loadingListings && !listingsError && approved.length === 0 && (
            <div className="up-empty-block">
              <p>No approved listings available to subscribe.</p>
              <p className="up-empty-hint">A listing must be approved before you can subscribe to a plan.</p>
            </div>
          )}
          {!loadingListings && !listingsError && approved.length > 0 && (
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
                    <button type="button" className="up-sub-btn" onClick={() => pickListing(l.id)}>
                      <ExternalLink size={12} />
                      Select
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* ── Step: plan cards ───────────────────────────────────────────── */}
      {step === "plans" && (
        <>
          {!initialWebsiteId && (
            <button type="button" className="up-back-btn" onClick={() => setStep("listing")}>
              <ArrowLeft size={13} strokeWidth={2.5} /> Back
            </button>
          )}

          {activeSub && (
            <div className="up-active-notice">
              Active plan: <strong>
                {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)}
              </strong> — select a higher plan to upgrade.
            </div>
          )}

          {loadingPlans && (
            <div className="up-state"><Loader size={16} className="up-spin" /> Loading plans…</div>
          )}
          {!loadingPlans && plansError && (
            <p className="up-error">Couldn't load plans. Please try again.</p>
          )}
          {!loadingPlans && !plansError && plans.length === 0 && (
            <div className="up-state">No plans available.</div>
          )}
          {!loadingPlans && !plansError && plans.length > 0 && (
            <div className="up-plan-grid">
              {planOrder.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan?.id === plan.id}
                  locked={isPlanLocked(plan)}
                  current={isCurrentPlan(plan)}
                  onClick={() => pickPlan(plan)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Step: verify ───────────────────────────────────────────────── */}
      {step === "verify" && selectedPlan && (
        <>
          <div className="up-verify-health">
            <PaymentHealth />
            <span>
              {paymentOnline === null
                ? "Checking payment service…"
                : paymentOnline
                  ? "Payment service online"
                  : "Payment service may be unavailable"}
            </span>
          </div>

          <p className="up-verify-hint">
            Send exactly{" "}
            <strong>{Number(selectedPlan.amount).toLocaleString()} {selectedPlan.currency}</strong>{" "}
            to the DirTera merchant account via Telebirr or CBE, then paste the receipt URL below.
          </p>

          <form onSubmit={handleVerifySubmit} className="up-verify-form">
            <label htmlFor="up-receipt">Receipt URL</label>
            <input
              id="up-receipt"
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://transactioninfo.ethiotelecom.et/receipt/…"
              required
              autoFocus
            />
            {receiptError && <p className="up-error">{receiptError}</p>}
            <div className="up-actions up-actions--split">
              <button
                type="button"
                className="up-btn-ghost"
                onClick={() => { setStep("plans"); setReceiptUrl(""); setReceiptError(""); }}
              >
                <ArrowLeft size={13} strokeWidth={2.5} /> Back
              </button>
              <button
                type="submit"
                className="up-btn-primary"
                disabled={isVerifying || !receiptUrl.trim()}
              >
                {isVerifying
                  ? <><Loader size={13} className="up-spin" /> Verifying…</>
                  : "Verify payment"}
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── Step: result ───────────────────────────────────────────────── */}
      {step === "result" && (
        <div className="up-result">
          {verifyResult ? (
            <>
              <div className="up-result-icon up-result-icon--ok">
                <Check size={22} strokeWidth={2.5} />
              </div>
              <p className="up-result-title">Payment submitted</p>
              <p className="up-result-msg">
                Your payment is being reviewed. Your listing will be updated once verified.
              </p>
              <div className="up-actions">
                <button type="button" className="up-btn-primary" onClick={handleDone}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="up-result-icon up-result-icon--err">
                <AlertCircle size={22} strokeWidth={2} />
              </div>
              <p className="up-result-title">Verification failed</p>
              <p className="up-result-msg">{verifyError}</p>
              <div className="up-actions up-actions--split">
                <button type="button" className="up-btn-ghost" onClick={onClose}>Dismiss</button>
                <button type="button" className="up-btn-primary" onClick={handleRetry}>Try again</button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Subscriptions popup
// ─────────────────────────────────────────────────────────────────────────────
export function SubscriptionsPopup({ onClose }) {
  const [subscribeId, setSubscribeId] = useState(null);

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

  // When user clicks Upgrade/Renew/Resubscribe, open inline plan modal
  if (subscribeId) {
    return (
      <SubscribePlanModal
        onClose={onClose}
        initialWebsiteId={subscribeId}
      />
    );
  }

  return (
    <Modal title="My Subscriptions" onClose={onClose}>
      {isLoading && (
        <div className="up-state"><Loader size={16} className="up-spin" /> Loading…</div>
      )}
      {!isLoading && isError && <p className="up-error">Couldn't load subscriptions.</p>}
      {!isLoading && !isError && subs.length === 0 && (
        <div className="up-empty-block">
          <CreditCard size={28} strokeWidth={1.5} className="up-empty-icon" />
          <p>No subscriptions yet.</p>
          <p className="up-empty-hint">Open Subscribe from this menu to pick a plan for an approved listing.</p>
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
            const actionLabel = isExpired
              ? "Resubscribe"
              : expiring
                ? "Renew"
                : canUpgrade
                  ? `Upgrade → ${upgrade.label}`
                  : null;

            return (
              <li
                key={sub.id}
                className={`up-sub-row${expiring ? " up-sub-row--warn" : ""}${isExpired ? " up-sub-row--expired" : ""}`}
              >
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
                    onClick={() => setSubscribeId(sub.website_id)}
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Subscribe popup (entry point from user menu)
// ─────────────────────────────────────────────────────────────────────────────
export function SubscribePopup({ onClose }) {
  return <SubscribePlanModal onClose={onClose} />;
}
