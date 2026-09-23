import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="site-header">
      <div className="nav-container">
        <Link to="/" className="site-logo">
          DirTera
        </Link>

        <nav className="main-nav">
          <Link to="/" className="nav-link">
            Browse
          </Link>

          {isAuthenticated ? (
            <>
              <Link to="/account" className="nav-link">
                My Account
              </Link>

              <button
                type="button"
                className="nav-button"
                onClick={logout}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Sign in
              </Link>

              <Link to="/register" className="nav-register">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;