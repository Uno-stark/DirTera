import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import "../styles/account.css";

function Account() {
  const { user, setUser, logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.patch("/api/v1/users/me", {
        full_name: fullName || null,
        avatar_url: avatarUrl || null,
      });
      setUser(data);
      setSuccess("Profile updated.");
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(user.full_name || "");
    setAvatarUrl(user.avatar_url || "");
    setError("");
    setEditing(false);
  };

  const initials = user?.full_name
    ? user.full_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <main className="account-page">
      <div className="account-card">

        {/* Header */}
        <div className="account-card-header">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="account-avatar" />
          ) : (
            <div className="account-avatar-placeholder">{initials}</div>
          )}
          <div className="account-header-meta">
            <h1>{user?.full_name || "My Account"}</h1>
            <p>{user?.email}</p>
          </div>
        </div>

        {/* View mode */}
        {!editing ? (
          <>
            <div className="account-info-row">
              <span className="account-info-label">Full name</span>
              {user?.full_name ? (
                <span className="account-info-value">{user.full_name}</span>
              ) : (
                <span className="account-info-value muted">Not set</span>
              )}
            </div>

            <div className="account-info-row">
              <span className="account-info-label">Email</span>
              <span className="account-info-value">{user?.email}</span>
            </div>

            {success && <p className="account-success" style={{ marginTop: 16 }}>{success}</p>}

            <div className="account-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="account-btn-primary"
                onClick={() => setEditing(true)}
              >
                Edit profile
              </button>
            </div>
          </>
        ) : (
          /* Edit mode */
          <form onSubmit={handleSave} className="account-form">
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </label>

            <label>
              Avatar URL
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
              />
            </label>

            {error && <p className="account-error">{error}</p>}

            <div className="account-actions">
              <button type="submit" className="account-btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="account-btn-secondary" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="account-footer">
          <button type="button" className="account-btn-danger" onClick={logout}>
            Sign out
          </button>
        </div>

      </div>
    </main>
  );
}

export default Account;
