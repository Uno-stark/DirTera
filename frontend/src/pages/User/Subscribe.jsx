import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Loader, X, AlertCircle, Lock } from "lucide-react";
import api from "../../api/client";
import {
  fetchPlans,
  fetchSubscriptions,
  fetchPaymentHealth,
  fetchWebsiteDetail,
  keys,
} from "../../api/queries";
import PaymentHealth from "../../components/PaymentHealth";
import "../../styles/payment.css";

function parseFeatures(description) {
  if (!description) return [];
  return description.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, selected, onClick, locked, current }) {
  const features = parseFeatures(plan.description);
  return (
    <button
      type="button"
      disabled={locked}
      className={[
        "sp-card",
        selected          ? "sp-card--selected" : "",
        plan.is_premiered ? "sp-card--featured"  : "",
        locked            ? "sp-card--locked"    : "",
        current           ? "sp-card--current"   : "",
      ].filter(Boolean).join(" ")}
      onClick={locked ? undefined : onClick}
      aria-disabled={locked}
    >
      {plan.is_premiered && !locked && (
        <span className="sp-featured-tag">Premiered</span>
      )}
      {locked && (
        <span className="sp-locked-tag">
          <Lock size={9} strokeWidth={2.5} />
          {current ? "Current plan" : "Not available"}
        </span>
      )}

      <div className="sp-card-top">
        <span className="sp-card-label">{plan.label}</span>
        <span className="sp-card-price">
          {Number(plan.amount).toLocaleString()}
          <small> {plan.currency}</small>
        </span>
      </div>
      <p className="sp-card-duration">{plan.duration_days} days</p>
      {features.length > 0 && (
        <ul className="sp-features">
          {features.map((f, i) => (
            <li key={i}>
              <Check size={12} strokeWidth={2.5} className="sp-check" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

// ── Verification popup ────────────────────────────────────────────────────────
function VerifyModal({ plan, onClose, onSubmit, paymentOnline }) {
  const [receiptUrl, setReceiptUrl] = useState("");
  const [error,      setError]      = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!receiptUrl.trim()) { setError("Please paste your receipt URL."); return; }
    setError("");
    onSubmit(receiptUrl.trim());
  };

  return (
    <div className="sp-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label="Payment verification">
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-modal-header">
          <div>
            <h2>Verify payment</h2>
            <p>{plan.label} · {Number(plan.amount).toLocaleString()} {plan.currency}</p>
          </div>
          <button className="sp-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="sp-modal-health">
          <PaymentHealth />
          <span>
            {paymentOnline === null
              ? "Checking payment service…"
              : paymentOnline
                ? "Payment service online"
                : "Payment service may be unavailable"}
          </span>
        </div>

        <p className="sp-modal-hint">
          Send exactly{" "}
          <strong>{Number(plan.amount).toLocaleString()} {plan.currency}</strong>{" "}
          to the DirTera merchant account via Telebirr or CBE, then paste the
          receipt URL below.
        </p>

        <form onSubmit={handleSubmit} className="sp-modal-form">
          <label htmlFor="sp-receipt">Receipt URL</label>
          <input
            id="sp-receipt"
            type="url"
            value={receiptUrl}
            onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="https://transactioninfo.ethiotelecom.et/receipt/…"
            required
            autoFocus
          />
          {error && <p className="sp-modal-error">{error}</p>}
          <div className="sp-modal-actions">
            <button type="button" className="sp-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="sp-btn-primary" disabled={!receiptUrl.trim()}>
              Verify payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Verifying overlay ─────────────────────────────────────────────────────────
function VerifyingOverlay() {
  return (
    <div className="sp-verifying-overlay" role="status" aria-live="polite">
      <Loader size={28} className="sp-spinner" />
      <p>Verifying payment…</p>
    </div>
  );
}

// ── Result popup ──────────────────────────────────────────────────────────────
function ResultModal({ isSuccess, error, onClose, onRetry }) {
  return (
    <div
      className="sp-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && isSuccess) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <div className="sp-modal sp-modal--result" onClick={(e) => e.stopPropagation()}>
        {isSuccess ? (
          <>
            <div className="sp-result-icon sp-result-icon--ok">
              <Check size={24} strokeWidth={2.5} />
            </div>
            <h2>Payment submitted</h2>
            <p className="sp-result-msg">
              Your payment is being reviewed. Your listing will be updated once verified.
            </p>
            <div className="sp-modal-actions">
              <Link to="/dashboard" className="sp-btn-primary">Back to dashboard</Link>
            </div>
          </>
        ) : (
          <>
            <div className="sp-result-icon sp-result-icon--err">
              <AlertCircle size={24} strokeWidth={2} />
            </div>
            <h2>Verification failed</h2>
            <p className="sp-result-msg">{error}</p>
            <div className="sp-modal-actions">
              <button type="button" className="sp-btn-ghost" onClick={onClose}>Dismiss</button>
              <button type="button" className="sp-btn-primary" onClick={onRetry}>Try again</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function Subscribe() {
  const { websiteId } = useParams();

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showVerify,   setShowVerify]   = useState(false);
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError,  setVerifyError]  = useState("");
  const [showResult,   setShowResult]   = useState(false);

  // ── Data queries (all run in parallel, all cached) ────────────────────────
  const { data: website } = useQuery({
    queryKey: keys.websiteDetail(websiteId),
    queryFn:  () => fetchWebsiteDetail(websiteId),
    staleTime: 5 * 60_000,
  });

  const {
    data:      plans = [],
    isLoading: isLoadingPlans,
    isError:   isPlansError,
  } = useQuery({
    queryKey: keys.plans(),
    queryFn:  fetchPlans,
    staleTime: 5 * 60_000,
  });

  const { data: allSubs = [] } = useQuery({
    queryKey: keys.subscriptions(),
    queryFn:  fetchSubscriptions,
    staleTime: 60_000,
  });

  // Payment health — low priority, failure is non-blocking
  const { data: healthData } = useQuery({
    queryKey: keys.paymentHealth(),
    queryFn:  fetchPaymentHealth,
    staleTime: 2 * 60_000,
    retry: false,
  });

  const paymentOnline = healthData
    ? (healthData.ok && healthData.components?.every((c) => c.status === "operational"))
    : null;

  // Active or pending sub for this specific website
  const activeSub = allSubs.find(
    (s) => s.website_id === websiteId &&
           (s.status === "active" || s.status === "pending")
  ) ?? null;

  // ── Plan ordering + lock logic ────────────────────────────────────────────
  const planOrder = [...plans].sort((a, b) => Number(a.amount) - Number(b.amount));

  const activeIdx = activeSub
    ? planOrder.findIndex((p) => p.slug === activeSub.plan)
    : -1;

  const isPlanLocked   = (plan) => {
    if (!activeSub) return false;
    return planOrder.findIndex((p) => p.slug === plan.slug) <= activeIdx;
  };
  const isCurrentPlan  = (plan) => activeSub?.plan === plan.slug;

  const handleSelectPlan = (plan) => {
    if (isPlanLocked(plan)) return;
    setSelectedPlan(plan);
    setShowVerify(true);
  };

  const handleVerifySubmit = async (receiptUrl) => {
    setShowVerify(false);
    setIsVerifying(true);
    setVerifyResult(null);
    setVerifyError("");
    try {
      const { data } = await api.post("/api/v1/payments/verify", {
        website_id:  websiteId,
        plan:        selectedPlan.slug,
        receipt_url: receiptUrl,
      });
      setVerifyResult(data);
    } catch (err) {
      const httpStatus = err.response?.status;
      const detail     = err.response?.data?.detail;
      if (httpStatus === 409)      setVerifyError("This receipt has already been used.");
      else if (httpStatus === 503) setVerifyError("Payment service unavailable. Try again shortly.");
      else                         setVerifyError(typeof detail === "string" ? detail : "Couldn't verify payment. Check the receipt URL.");
    } finally {
      setIsVerifying(false);
      setShowResult(true);
    }
  };

  const handleRetry       = () => { setShowResult(false); setVerifyError(""); setShowVerify(true); };
  const handleResultClose = () => { setShowResult(false); setVerifyResult(null); setVerifyError(""); setSelectedPlan(null); };

  return (
    <main className="sp-page">
      {isVerifying && <VerifyingOverlay />}

      {showVerify && selectedPlan && (
        <VerifyModal
          plan={selectedPlan}
          onClose={() => setShowVerify(false)}
          onSubmit={handleVerifySubmit}
          paymentOnline={paymentOnline}
        />
      )}

      {showResult && (
        <ResultModal
          isSuccess={Boolean(verifyResult)}
          error={verifyError}
          onClose={handleResultClose}
          onRetry={handleRetry}
        />
      )}

      <div className="sp-container">
        <div className="sp-header">
          <Link to="/dashboard" className="sp-back">
            <ArrowLeft size={14} strokeWidth={2.5} />
            Back to dashboard
          </Link>
          <h1>Subscribe</h1>
          {website && <p className="sp-subtitle">{website.name}</p>}
        </div>

        {activeSub && (
          <div className="sp-active-notice">
            Active plan: <strong>
              {activeSub.plan.charAt(0).toUpperCase() + activeSub.plan.slice(1)}
            </strong>{" "}— select a higher plan to upgrade.
          </div>
        )}

        {isLoadingPlans && <div className="sp-state">Loading plans…</div>}
        {isPlansError   && <div className="sp-state sp-state--error">Couldn't load plans. Please try again.</div>}
        {!isLoadingPlans && !isPlansError && plans.length === 0 && (
          <div className="sp-state">No plans available.</div>
        )}
        {!isLoadingPlans && !isPlansError && plans.length > 0 && (
          <div className="sp-plan-grid">
            {planOrder.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                locked={isPlanLocked(plan)}
                current={isCurrentPlan(plan)}
                onClick={() => handleSelectPlan(plan)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default Subscribe;
