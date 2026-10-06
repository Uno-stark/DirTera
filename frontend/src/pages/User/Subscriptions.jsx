import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import PaymentHealth from "../../components/PaymentHealth";
import "../../styles/payment.css";

const STATUS_LABELS = {
  active: { label: "Active", color: "green" },
  pending: { label: "Pending", color: "yellow" },
  expired: { label: "Expired", color: "gray" },
  cancelled: { label: "Cancelled", color: "gray" },
  failed: { label: "Failed", color: "red" },
};

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/v1/payments/subscriptions");
        setSubscriptions(data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            "We couldn't load your subscriptions."
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  const isExpiringSoon = (expiresAt) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt) - new Date();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // within 7 days
  };

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
              <h1>My Subscriptions</h1>
              <p className="payment-subtitle">
                All subscription payments for your listings.
              </p>
            </div>

            <PaymentHealth />
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        {isLoading && (
          <p className="payment-loading">Loading subscriptions...</p>
        )}

        {!isLoading && error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && subscriptions.length === 0 && (
          <div className="payment-empty">
            <h3>No subscriptions yet</h3>
            <p>
              Subscribe from your dashboard to keep your listings active.
            </p>
            <Link to="/dashboard" className="payment-primary-button">
              Go to dashboard
            </Link>
          </div>
        )}

        {!isLoading && !error && subscriptions.length > 0 && (
          <div className="subscriptions-list">
            {subscriptions.map((sub) => {
              const statusInfo =
                STATUS_LABELS[sub.status] || STATUS_LABELS.pending;
              const expiring = isExpiringSoon(sub.expires_at);

              return (
                <article
                  key={sub.id}
                  className={`subscription-card ${expiring ? "expiring" : ""}`}
                >
                  <div className="subscription-card-header">
                    <div className="subscription-plan-row">
                      <span className="subscription-plan-name">
                        {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}{" "}
                        plan
                      </span>

                      <span
                        className={`subscription-status-badge status-${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    {expiring && (
                      <p className="subscription-expiring-notice">
                        ⚠ Expiring soon — renew to stay listed
                      </p>
                    )}
                  </div>

                  <div className="subscription-details">
                    <div className="subscription-detail-row">
                      <span>Amount</span>
                      <strong>
                        {Number(sub.amount).toLocaleString()} {sub.currency}
                      </strong>
                    </div>

                    {sub.payment_provider && (
                      <div className="subscription-detail-row">
                        <span>Provider</span>
                        <strong>{sub.payment_provider}</strong>
                      </div>
                    )}

                    {sub.receipt_no && (
                      <div className="subscription-detail-row">
                        <span>Receipt no.</span>
                        <strong>{sub.receipt_no}</strong>
                      </div>
                    )}

                    <div className="subscription-detail-row">
                      <span>Started</span>
                      <strong>{formatDate(sub.starts_at)}</strong>
                    </div>

                    <div className="subscription-detail-row">
                      <span>Expires</span>
                      <strong
                        className={expiring ? "subscription-date-warning" : ""}
                      >
                        {formatDate(sub.expires_at)}
                      </strong>
                    </div>

                    <div className="subscription-detail-row">
                      <span>Subscribed on</span>
                      <strong>{formatDate(sub.created_at)}</strong>
                    </div>
                  </div>

                  {(sub.status === "expired" || expiring) && (
                    <div className="subscription-card-footer">
                      <Link
                        to={`/subscribe/${sub.website_id}`}
                        className="payment-primary-button subscription-renew-button"
                      >
                        {sub.status === "expired" ? "Resubscribe" : "Renew now"}
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default Subscriptions;
