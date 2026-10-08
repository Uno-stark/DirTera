import { Link, useLocation, useNavigate } from "react-router-dom";
import logoSrc from "../assets/logo.js";
import "../styles/footer.css";

function SiteFooter() {
  const navigate = useNavigate();
  const location = useLocation();

  const goModal = (path) =>
    navigate(path, { state: { backgroundLocation: location } });

  return (
    <footer className="site-footer">
      <div className="footer-container footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            {logoSrc && (
              <img src={logoSrc} alt="" className="footer-logo-image" aria-hidden="true" />
            )}
            <span className="footer-logo-wordmark">DirTera</span>
          </Link>
          <p>A considered guide to the businesses<br />that make a place feel like itself.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <p className="footer-col-heading">About</p>
            <Link to="/legal/terms"   className="footer-link">Terms of Service</Link>
            <Link to="/legal/privacy" className="footer-link">Privacy Policy</Link>
            
          </div>
          <div className="footer-col">
            <p className="footer-col-heading">Business</p>
            <Link to="#" className="footer-link">Data</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-container">
          <p>&copy; {new Date().getFullYear()} DirTera. Places, properly considered.</p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
