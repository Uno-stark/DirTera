import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle } from "lucide-react";

/**
 * LogoutToast — brief bottom-right notification shown after sign-out.
 *
 * Props:
 *   state   — "done" | "error"  (anything else renders nothing)
 *   onDone  — called after the auto-dismiss timer fires
 */
const DISMISS_MS = 3200;

export default function LogoutToast({ state, onDone }) {
  useEffect(() => {
    if (state !== "done" && state !== "error") return;
    const t = setTimeout(onDone, DISMISS_MS);
    return () => clearTimeout(t);
  }, [state, onDone]);

  if (state !== "done" && state !== "error") return null;

  const isError = state === "error";

  return createPortal(
    <div
      className={`logout-toast${isError ? " logout-toast--error" : ""}`}
      role="status"
      aria-live="polite"
    >
      {isError
        ? <AlertCircle  size={16} className="logout-toast-icon" />
        : <CheckCircle  size={16} className="logout-toast-icon" />
      }
      <span>
        {isError
          ? "Signed out locally — couldn't reach server."
          : "You've been signed out."}
      </span>
    </div>,
    document.body
  );
}
