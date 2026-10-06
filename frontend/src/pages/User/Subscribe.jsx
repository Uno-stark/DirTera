import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PaymentHealth from "../../components/PaymentHealth";
import "../../styles/payment.css";

// ── Steps ─────────────────────────────────────────────────────────────────────
// SELECT_PLAN → PAY → SUCCESS

function Subscribe() {
  const { websiteId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState("SELECT_PLAN");

  // Plans loaded from DB via GET /payments/plans
  const [plans, setPlans] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [selectedPlan, setSelectedPlan] = useState(null); // plan object from DB
  const [planInfo, setPlanInfo] = useState(null);          // cost preview from /subscribe/info
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");

  const [receiptUrl, setReceiptUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [result, setResult] = useState(null);
  const [website, setWebsite] = useState(null);

  // Load website name + available plans in parallel
  useEffect(() => {
    const load = async () => {
      const [websiteRes, plansRes] = await Promise.allSettled([
        api.get(`/api/v1/websites/${websiteId}`),
        api.get("/api/v1/payments/plans"),
      ]);

      if (websiteRes.status === "fulfilled") {
        setWebsite(websiteRes.value.data);
      }

      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data);
      } else {
        setPlansError("We couldn't load the available plans. Please try again.");
      }

      setIsLoadingPlans(false);
    };

    load();
  }, [websiteId]);

  // When a plan card is clicked, fetch cost preview
  useEffect(() => {
    if (!selectedPlan) return;

    const loadInfo = async () => {
      setIsLoadingInfo(true);
      setInfoError("");

      try {
        const { data } = await api.get("/api/v1/payments/subscribe/info", {
          params: { website_id: websiteId, plan: selectedPlan.slug },
        });
        setPlanInfo(data);
      } catch (err) {
        setInfoError(
          err.response?.data?.detail ||
            "We couldn't load the subscription details."
        );
        setPlanInfo(null);
      } finally {
        setIsLoadingInfo(false);
      }
    };

    loadInfo();
  }, [selectedPlan, websiteId]);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!receiptUrl.trim()) {
      setVerifyError("Please paste your receipt URL.");
      return;
    }

    setVerifyError("");
    setIsVerifying(true);

    try {
      const { data } = await api.post("/api/v1/payments/verify", {
        website_id: websiteId,
        plan: selectedPlan.slug,
        receipt_url: receiptUrl.trim(),
      });

      setResult(data);
      setStep("SUCCESS");
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      if (status === 409) {
        setVerifyError(
          "This receipt has already been used. Please use a different receipt."
        );
      } else if (status === 503) {
        setVerifyError(
          "The payment verification service is currently unavailable. Please try again shortly."
        );
      } else {
        setVerifyError(
          typeof detail === "string"
            ? detail
            : "We couldn't verify your payment. Please check the receipt URL and try again."
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  return (
    <main className="payment-page">
      <div className="payment-container">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="payment-header">
          <Link to="/dashboard" className="payment-back-link">
            ← Back to dashboard
          </Link>

          <div className="payment-header-row">
            <div>
              <h1>Subscribe</h1>
              {website && (
                <p className="payment-subtitle">
                  Listing: <strong>{website.name}</strong>
                </p>
              )}
            </div>

            <PaymentHealth />
          </div>
        </div>

        {/* ── Step 1: Select plan ─────────────────────────────────────── */}
        {step === "SELECT_PLAN" && (
          <div className="payment-step">
            <h2>Choose a plan</h2>
            <p className="payment-step-description">
              Your listing must be approved before subscribing. Subscriptions
              keep your listing active and visible in the directory.
            </p>

            {isLoadingPlans && <p className="payment-loading">Loading plans...</p>}

            {plansError && (
              <p className="payment-error" role="alert">{plansError}</p>
            )}

            {!isLoadingPlans && !plansError && plans.length === 0 && (
              <p className="payment-loading">No plans are currently available.</p>
            )}

            {!isLoadingPlans && plans.length > 0 && (
              <>
                <div className="plan-grid">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={`plan-card ${
                        selectedPlan?.id === plan.id ? "selected" : ""
                      } ${plan.is_premiered ? "featured" : ""}`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {plan.is_premiered && (
                        <span className="plan-featured-badge">Premiered</span>
                      )}

                      <h3>{plan.label}</h3>
                      <p className="plan-duration">{plan.duration_days} days</p>

                      {plan.description && (
                        <p className="plan-description">{plan.description}</p>
                      )}

                      <p className="plan-price">
                        {Number(plan.amount).toLocaleString()} {plan.currency}
                      </p>
                    </button>
                  ))}
                </div>

                {infoError && (
                  <p className="payment-error" role="alert">{infoError}</p>
                )}

                {isLoadingInfo && (
                  <p className="payment-loading">Loading details...</p>
                )}

                {planInfo && !isLoadingInfo && (
                  <div className="plan-summary">
                    <div className="plan-summary-row">
                      <span>Plan</span>
                      <strong>{planInfo.label || planInfo.plan}</strong>
                    </div>
                    <div className="plan-summary-row">
                      <span>Duration</span>
                      <strong>{planInfo.duration_days} days</strong>
                    </div>
                    {planInfo.is_premiered && (
                      <div className="plan-summary-row">
                        <span>Effect</span>
                        <strong>Premieres your listing ✓</strong>
                      </div>
                    )}
                    <div className="plan-summary-row plan-summary-total">
                      <span>Total</span>
                      <strong>
                        {Number(planInfo.amount).toLocaleString()}{" "}
                        {planInfo.currency}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="payment-actions">
                  <Link to="/dashboard" className="payment-secondary-button">
                    Cancel
                  </Link>

                  <button
                    type="button"
                    className="payment-primary-button"
                    onClick={() => setStep("PAY")}
                    disabled={!selectedPlan || !planInfo || isLoadingInfo}
                  >
                    Continue to payment
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Pay + verify ────────────────────────────────────── */}
        {step === "PAY" && planInfo && (
          <div className="payment-step">
            <h2>Complete your payment</h2>

            <div className="payment-instructions">
              <h3>How to pay</h3>
              <ol>
                <li>Open your Telebirr, CBE, or other supported payment app.</li>
                <li>
                  Send exactly{" "}
                  <strong>
                    {Number(planInfo.amount).toLocaleString()} {planInfo.currency}
                  </strong>{" "}
                  to the DirTera merchant account.
                </li>
                <li>
                  Once payment is confirmed, copy the full receipt URL from
                  your payment app.
                </li>
                <li>Paste the receipt URL below and click Verify.</li>
              </ol>

              <div className="payment-amount-box">
                <span>Amount to pay</span>
                <strong>
                  {Number(planInfo.amount).toLocaleString()} {planInfo.currency}
                </strong>
              </div>
            </div>

            <form className="payment-verify-form" onSubmit={handleVerify}>
              <label htmlFor="receipt-url">Receipt URL *</label>
              <input
                id="receipt-url"
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://transactioninfo.ethiotelecom.et/receipt/..."
                required
                disabled={isVerifying}
              />
              <small>
                Paste the full receipt URL from your payment app (Telebirr,
                CBE, etc.)
              </small>

              {verifyError && (
                <p className="payment-error" role="alert">
                  {verifyError}
                </p>
              )}

              <div className="payment-actions">
                <button
                  type="button"
                  className="payment-secondary-button"
                  onClick={() => setStep("SELECT_PLAN")}
                  disabled={isVerifying}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="payment-primary-button"
                  disabled={isVerifying || !receiptUrl.trim()}
                >
                  {isVerifying ? "Verifying..." : "Verify payment"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Success ─────────────────────────────────────────── */}
        {step === "SUCCESS" && result && (
          <div className="payment-step payment-success">
            <div className="payment-success-icon">✓</div>

            <h2>Payment verified!</h2>
            <p>{result.message}</p>

            <div className="payment-success-details">
              <div className="plan-summary-row">
                <span>Plan</span>
                <strong>
                  {selectedPlan?.label || result.subscription.plan}
                </strong>
              </div>
              <div className="plan-summary-row">
                <span>Status</span>
                <strong>{result.subscription.status}</strong>
              </div>
              <div className="plan-summary-row">
                <span>Starts</span>
                <strong>{formatDate(result.subscription.starts_at)}</strong>
              </div>
              <div className="plan-summary-row">
                <span>Expires</span>
                <strong>{formatDate(result.subscription.expires_at)}</strong>
              </div>
              <div className="plan-summary-row">
                <span>Provider</span>
                <strong>{result.provider}</strong>
              </div>
              {result.subscription.receipt_no && (
                <div className="plan-summary-row">
                  <span>Receipt no.</span>
                  <strong>{result.subscription.receipt_no}</strong>
                </div>
              )}
            </div>

            <div className="payment-actions">
              <Link to="/subscriptions" className="payment-secondary-button">
                View subscriptions
              </Link>
              <Link to="/dashboard" className="payment-primary-button">
                Back to dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default Subscribe;
