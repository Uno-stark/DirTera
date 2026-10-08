import { useState } from "react";
import { Bell, Shield, Palette, Globe } from "lucide-react";
import api from "../../api/client";

function SettingSection({ icon, title, description, children }) {
  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#2563eb" }}>
          {icon}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>{title}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
          background: checked ? "#2563eb" : "#d1d5db",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "white",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

function AdminSettings() {
  const [notifications, setNotifications] = useState({
    newRequests: true,
    newUsers: true,
    subscriptions: false,
    systemAlerts: true,
  });
  const [appearance, setAppearance] = useState({ compactMode: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const handleMarkAllRead = async () => {
    setSaving(true);
    setSuccess("");
    try {
      await api.patch("/api/v1/notifications/read-all");
      setSuccess("All notifications marked as read.");
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Settings</h1>
      <p className="admin-subtitle">Manage your admin preferences and account settings.</p>

      {success && <p className="admin-success">{success}</p>}

      <div style={{ maxWidth: 800 }}>

        {/* Notifications */}
        <SettingSection icon={<Bell size={20} />} title="Notification Preferences" description="Choose which events you want to be notified about.">
          <ToggleRow label="New Website Requests" description="Notify when a new website is submitted for review" checked={notifications.newRequests} onChange={(v) => setNotifications((p) => ({ ...p, newRequests: v }))} />
          <ToggleRow label="New User Registrations" description="Notify when a new user signs up" checked={notifications.newUsers} onChange={(v) => setNotifications((p) => ({ ...p, newUsers: v }))} />
          <ToggleRow label="Subscription Activity" description="Notify on new subscriptions or cancellations" checked={notifications.subscriptions} onChange={(v) => setNotifications((p) => ({ ...p, subscriptions: v }))} />
          <ToggleRow label="System Alerts" description="Critical system and security alerts" checked={notifications.systemAlerts} onChange={(v) => setNotifications((p) => ({ ...p, systemAlerts: v }))} />
          <div style={{ marginTop: 16 }}>
            <button className="admin-button-outline" onClick={handleMarkAllRead} disabled={saving}>
              {saving ? "Marking…" : "Mark All Notifications as Read"}
            </button>
          </div>
        </SettingSection>

        {/* Appearance */}
        <SettingSection icon={<Palette size={20} />} title="Appearance" description="Customize how the admin panel looks.">
          <ToggleRow label="Compact Mode" description="Reduce spacing and padding for a denser layout" checked={appearance.compactMode} onChange={(v) => setAppearance((p) => ({ ...p, compactMode: v }))} />
        </SettingSection>

        {/* Security */}
        <SettingSection icon={<Shield size={20} />} title="Security" description="Account security and authentication settings.">
          <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#111827", marginBottom: 4 }}>Password & Authentication</div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              This admin account uses <strong>Google OAuth</strong> for authentication. Password changes are managed through your Google account settings.
            </div>
          </div>
          <div style={{ padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "#166534" }}>
              ✓ Your session is secured with JWT tokens and automatically refreshed.
            </div>
          </div>
        </SettingSection>

        {/* Platform */}
        <SettingSection icon={<Globe size={20} />} title="Platform Information" description="Current system configuration.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Platform", "DirTera Admin"],
              ["Version", "v1.0.0"],
              ["Environment", "Production"],
              ["API", "/api/v1"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{value}</div>
              </div>
            ))}
          </div>
        </SettingSection>

      </div>
    </div>
  );
}

export default AdminSettings;
