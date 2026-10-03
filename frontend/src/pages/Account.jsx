import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

function Account() {
  const { user, setUser, logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sync form when user loads
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

  return (
    <main>
      <h1>My Account</h1>

      {user.avatar_url && (
        <img
          src={user.avatar_url}
          alt="Avatar"
          style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 12 }}
        />
      )}

      {!editing ? (
        <>
          <p>Name: {user.full_name || <em style={{ color: "#9ca3af" }}>Not set</em>}</p>
          <p>Email: {user.email}</p>
          {success && <p style={{ color: "green" }}>{success}</p>}
          <button type="button" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        </>
      ) : (
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
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
          {error && <p style={{ color: "red" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <p style={{ marginTop: 24 }}>
        <button type="button" onClick={logout}>
          Sign out
        </button>
      </p>

      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}

export default Account;
