/**
 * Shared toast notification component for admin pages.
 * Usage:
 *   const { toasts, toast, dismissToast } = useToast();
 *   <Toast messages={toasts} onDismiss={dismissToast} />
 *   toast("Saved!", "success")  |  toast("Failed", "error")
 */
import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";

let _counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text, type = "success", duration = 3500) => {
    const id = ++_counter;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((m) => m.id !== id)), duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { toasts, toast, dismissToast };
}

export function Toast({ messages, onDismiss }) {
  if (!messages.length) return null;
  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      <div
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          display: "flex", flexDirection: "column", gap: 8,
          maxWidth: 380, pointerEvents: "none",
        }}
        aria-live="polite"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            role="alert"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px",
              background: m.type === "error" ? "#fef2f2" : "#f0fdf4",
              color:      m.type === "error" ? "#991b1b"  : "#166534",
              border:     `1px solid ${m.type === "error" ? "#fca5a5" : "#a7f3d0"}`,
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,.10)",
              fontSize: 13.5, fontWeight: 500,
              pointerEvents: "auto", cursor: "pointer",
              animation: "toast-in 0.2s ease",
            }}
            onClick={() => onDismiss(m.id)}
          >
            {m.type === "error"
              ? <AlertCircle size={15} style={{ flexShrink: 0 }} />
              : <CheckCircle size={15} style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{m.text}</span>
            <X size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </>
  );
}
