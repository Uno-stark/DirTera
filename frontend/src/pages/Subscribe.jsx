import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "../styles/subscribe.css";

const PLAN_LABELS = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  premiered: "Premiered",
};

const PLAN_DESCRIPTIONS = {
  basic: "Get listed and start receiving clicks.",
  standard: "More visibility across category pages.",
  premium: "Top placement and featured badges.",
  premiered: "Front-page spotlight in the Premiered section.",
};

// ── Step 1: Pick a plan ──────────────────────────────────────────────────────

function PlanPicker({ websiteId, onSelect }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/v1/payments/plans")
      .then(({ data }) => setPlans(data))
      .catch(() => setError("Could not load plans. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="sub-loading">Loading plans…</p>;
  if (error) return <p className="sub-error">{error}</p>;

  return (
    <div className="sub-plans">
      {plans.map((p) => (
        <button
          key={p.plan}
          type="button"
          className="sub-plan-card"
          onClick={() => onSelect(p.plan)}
        >
          <span className="sub-plan-name">{PLAN_LABELS[p.plan] ?? p.plan}</span>
          <span className="sub-plan-price">
            {p.amount.toLocaleString()} <small>ETB</small>
          </span>
          <span className="sub-plan-duration">{p.duration_days} days</span>
          <span className="sub-plan-desc">
            {PLAN_DESCRIPTIONS[p.plan] ?? ""}
          </span>
          <span className="sub-plan-cta">Choose →</span>
        </button>
      ))}
    </div>
  );
}

// ── Step 2: Preview cost + paste receipt ────────────────────────────────────

function PaymentForm({ websiteId, plan, onBack, onSuccess }) {
  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState("");

  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    api
      .get("/api/v1/payments/subscribe/info", {
        params: { website_id: websiteId, plan },
      })
      .then(({ data }) => setInfo(data))
      .catch((err) =>
        setInfoError(
          err.response?.data?.detail || "Could not load cost preview."
        )
      )
      .finally(() => setInfoLoading(false));
  }, [websiteId, plan]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!receiptUrl.trim()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const { data } = await api.post("/api/v1/payments/verify", {
        website_id: websiteId,
        plan,
        receipt_url: receiptUrl.trim(),
      });
      onSuccess(data);
    } catch (err) {
      setSubmitError(
        err.response?.data?.detail || "Verification failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sub-payment-form">
      <button type="button" className="sub-back-btn" onClick={onBack}>
        ← Back to plans
      </button>

      {infoLoading && <p className="sub-loading">Loading cost preview…</p>}
      {infoError && <p className="sub-error">{infoError}</p>}

      {info && (
        <div className="sub-cost-preview">
          <h2>Cost preview</h2>
          <table className="sub-preview-table">
            <tbody>
              <tr>
                <td>Listing</td>
                <td>{info.website_name}</td>
              </tr>
              <tr>
                <td>Plan</td>
                <td>{PLAN_LABELS[info.plan] ?? info.plan}</td>
              </tr>
              <tr>
                <td>Duration</td>
                <td>{info.duration_days} days</td>
              </tr>
              <tr className="sub-preview-total">
                <td>Amount to pay</td>
                <td>
                  {info.amount.toLocaleString()} {info.currency}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="sub-instructions">
            Pay exactly <strong>{info.amount.toLocaleString()} ETB</strong> via
            Telebirr, CBE, or any supported provider, then paste your receipt
            URL below.
          </p>

          <form onSubmit={handleSubmit} className="sub-receipt-form">
            <label htmlFor="receipt_url">Receipt URL</label>
            <input
              id="receipt_url"
              type="url"
              placeholder="https://..."
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
              disabled={submitting}
            />

            {submitError && (
              <p className="sub-error" role="alert">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              className="sub-submit-btn"
              disabled={submitting || !receiptUrl.trim()}
            >
              {submitting ? "Verifying…" : "Verify & activate"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Success ──────────────────────────────────────────────────────────

function SuccessView({ result, onDone }) {
  const { subscription, message } = result;
  return (
    <div className="sub-success">
      <div className="sub-success-icon">✓</div>
      <h2>Subscription activated</h2>
      <p>{message}</p>
      <dl className="sub-success-details">
        <dt>Plan</dt>
        <dd>{PLAN_LABELS[subscription.plan] ?? subscription.plan}</dd>
        <dt>Expires</dt>
        <dd>
          {subscription.expires_at
            ? new Date(subscription.expires_at).toLocaleDateString()
            : "—"}
        </dd>
        <dt>Receipt no.</dt>
        <dd>{subscription.receipt_no || "—"}</dd>
      </dl>
      <button type="button" className="sub-submit-btn" onClick={onDone}>
        Back to dashboard
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Subscribe() {
  const { websiteId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialPlan = searchParams.get("plan") || null;
  const [step, setStep] = useState(initialPlan ? "pay" : "plans");
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [result, setResult] = useState(null);

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setStep("pay");
  };

  const handleSuccess = (data) => {
    setResult(data);
    setStep("success");
  };

  return (
    <main className="sub-page">
      <header className="sub-header">
        <button
          type="button"
          className="sub-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>
        <h1>Subscribe</h1>
        <p>Boost your listing&apos;s visibility with a subscription plan.</p>
      </header>

      <div className="sub-body">
        {step === "plans" && (
          <PlanPicker websiteId={websiteId} onSelect={handlePlanSelect} />
        )}

        {step === "pay" && selectedPlan && (
          <PaymentForm
            websiteId={websiteId}
            plan={selectedPlan}
            onBack={() => setStep("plans")}
            onSuccess={handleSuccess}
          />
        )}

        {step === "success" && result && (
          <SuccessView
            result={result}
            onDone={() => navigate("/dashboard")}
          />
        )}
      </div>
    </main>
  );
}
