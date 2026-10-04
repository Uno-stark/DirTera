import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to /login; the Auth modal will render on top of "/" background
    return (
      <Navigate
        to="/login"
        state={{ from: location, backgroundLocation: { pathname: "/" } }}
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
