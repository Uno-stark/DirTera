/**
 * Auth — Google-only sign in / sign up modal.
 *
 * One button. No email. No password.
 * Google handles identity; the backend creates the account on first login.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X, BarChart2 } from "lucide-react";

import { startGoogleLogin } from "../../api/googleAuth";
import "../../styles/auth-modal.css";

function AuthModal({ isModal, onClose }) {
  // Lock scroll and listen for Escape when rendered as a modal
  useEffect(() => {
    if (!isModal) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [isModal, onClose]);

  const card = (
    <div
      className={isModal ? "auth-backdrop" : "auth-standalone"}
      onClick={isModal ? onClose : undefined}
    >
      <div
        className="auth-modal auth-modal-google-only"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to DirTera"
      >
        {/* Close */}
        {isModal && (
          <button
            type="button"
            className="auth-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Brand */}
        <div className="auth-header auth-header-centered">
          <div className="auth-brand auth-brand-centered">
            <BarChart2
              size={28}
              className="auth-brand-icon"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>DirTera</span>
          </div>
          <h2>Welcome to DirTera</h2>
          <p>
            Discover, review, and register businesses.<br />
            Sign in with your Google account to continue.
          </p>
        </div>

        {/* Google CTA */}
        <button
          type="button"
          className="auth-google-btn auth-google-hero"
          onClick={startGoogleLogin}
          autoFocus={isModal}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Legal note */}
        <p className="auth-legal">
          By continuing you agree to our{" "}
          <a
            href="/api/v1/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="auth-legal-link"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/api/v1/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="auth-legal-link"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );

  return isModal ? createPortal(card, document.body) : card;
}

function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const bgLoc    = location.state?.backgroundLocation;
  const isModal  = Boolean(bgLoc);

  const onClose = () => navigate(bgLoc || "/", { replace: true });

  return <AuthModal isModal={isModal} onClose={onClose} />;
}

export default Auth;
