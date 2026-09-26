import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      navigate("/login?error=google_login_failed", { replace: true });
      return;
    }

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);

    const loadUser = async () => {
      try {
        const { data } = await api.get("/api/v1/auth/me");
        setUser(data);
        navigate("/account", { replace: true });
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        navigate("/login?error=google_login_failed", { replace: true });
      }
    };

    loadUser();
  }, [navigate, searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <h1>Signing you in...</h1>
          <p>Please wait while we complete your Google sign-in.</p>
        </div>
      </section>
    </main>
  );
}

export default GoogleCallback;