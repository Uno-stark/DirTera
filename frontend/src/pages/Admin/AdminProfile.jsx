import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { User, Mail, Shield, Calendar } from "lucide-react";
import api from "../../api/client";

function AdminProfile() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const { data } = await api.patch("/api/v1/users/me", { full_name: fullName });
      setUser(data);
      setSuccess("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">My Profile</h1>
      <p className="admin-subtitle">View and update your admin account details.</p>

      {success && <p className="admin-success">{success}</p>}
      {error && <p className="admin-error">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, maxWidth: 900 }}>

        {/* Left — Avatar card */}
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", background: "#2563eb",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <User size={36} color="white" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{user?.full_name || "—"}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{user?.email}</div>
          </div>
          <span style={{
            background: "#dbeafe", color: "#1d4ed8", fontSize: 12,
            fontWeight: 600, padding: "3px 12px", borderRadius: 99,
          }}>
            {user?.is_admin ? "Administrator" : "User"}
          </span>
        </div>

        {/* Right — Details */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Account Details</h2>
            {!editing && (
              <button className="admin-button-outline" onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>

          {!editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <InfoRow icon={<User size={16} />} label="Full Name" value={user?.full_name || "—"} />
              <InfoRow icon={<Mail size={16} />} label="Email" value={user?.email} />
              <InfoRow icon={<Shield size={16} />} label="Role" value={user?.is_admin ? "Administrator" : "User"} />
              <InfoRow icon={<Shield size={16} />} label="Status" value={user?.is_active ? "Active" : "Inactive"} />
              <InfoRow icon={<Calendar size={16} />} label="Joined" value={user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
            </div>
          ) : (
            <form className="admin-form" onSubmit={handleSave}>
              <label>
                Full Name
                <input
                  type="text"
                  className="admin-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </label>
              <label>
                Email
                <input type="email" className="admin-input" value={user?.email} disabled style={{ opacity: 0.6, cursor: "not-allowed" }} />
              </label>
              <div className="admin-form-row">
                <button type="submit" className="admin-button" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" className="admin-button-outline" onClick={() => { setEditing(false); setFullName(user?.full_name || ""); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ color: "#6b7280", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>{value}</div>
      </div>
    </div>
  );
}

export default AdminProfile;
