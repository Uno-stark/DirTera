import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";

function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
 feat/public-auth
      navigate("/login?error=google_login_failed", {
        replace: true,
      });

      navigate("/login?error=google_login_failed", { replace: true });
 dev
      return;
    }

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);

    const loadUser = async () => {
      try {
        await api.get("/api/v1/auth/me");
        navigate("/account", { replace: true });
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
 feat/public-auth

        navigate("/login?error=google_login_failed", {
          replace: true,
        });

        navigate("/login?error=google_login_failed", { replace: true });
 dev
      }
    };

    loadUser();
  }, [navigate, searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <h1>Signing you in...</h1>
 feat/public-auth

          <p>
            Please wait while we complete your Google sign-in.
          </p>

          <p>Please wait while we complete your Google sign-in.</p>
 dev
        </div>
      </section>
    </main>
  );
}

 feat/public-auth
export default GoogleCallback;


export default GoogleCallback;
 dev
