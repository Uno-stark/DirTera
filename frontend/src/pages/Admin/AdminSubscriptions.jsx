import { Link } from "react-router-dom";

function AdminSubscriptions() {
  return (
    <main className="payment-page">
      <div className="payment-container">
        {/* Header */}
        <div className="payment-header">
          <Link
            to="/admin/dashboard"
            className="payment-back-link"
          >
            ← Back to dashboard
          </Link>

          <div className="payment-header-row">
            <div>
              <h1>Subscriptions</h1>
              <p className="payment-subtitle">
                Manage platform subscriptions.
              </p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="admin-stats-grid">
          <div className="admin-card">
            <div className="admin-card-label">
              Active Subscriptions
            </div>
            <div className="admin-card-value">
              0
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-label">
              Pending
            </div>
            <div className="admin-card-value">
              0
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-label">
              Expired
            </div>
            <div className="admin-card-value">
              0
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-label">
              Total
            </div>
            <div className="admin-card-value">
              0
            </div>
          </div>
        </div>

        {/* Subscriptions table */}
        <div className="admin-card" style={{ marginTop: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                All Subscriptions
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "#6b7280",
                }}
              >
                View and manage platform subscriptions.
              </p>
            </div>
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Website</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Start Date</th>
                  <th style={thStyle}>Expiry Date</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    No subscription data available yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "14px",
  fontWeight: 600,
  color: "#374151",
};

export default AdminSubscriptions;