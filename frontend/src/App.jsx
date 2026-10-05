import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

// Public pages
import Home           from "./pages/Home";
import BusinessDetail from "./pages/BusinessDetail";

// Auth — unified single component
import Auth           from "./pages/User/Auth";
import GoogleCallback from "./pages/User/GoogleCallback";

// User pages
import Account       from "./pages/User/Account";
import Dashboard     from "./pages/User/Dashboard";
import ListingForm   from "./pages/User/ListingForm";
import Notifications from "./pages/User/Notifications";
import Analytics     from "./pages/User/Analytics";
import Subscribe     from "./pages/User/Subscribe";
import Subscriptions from "./pages/User/Subscriptions";

// Admin pages
import AdminLayout    from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import Categories from "./pages/Admin/Categories";
import Domains from "./pages/Admin/Domains";
import AdminWebsites from "./pages/Admin/Websites";
import Users from "./pages/Admin/Users";
import AdminAnalysis from "./pages/Admin/AdminAnalytics";
import AdminSubscriptions from "./pages/Admin/AdminSubscriptions";

// Shared
import ProtectedRoute from "./components/ProtectedRoute";

// Shared
import ProtectedRoute from "./components/ProtectedRoute";

function AuthModalLayer() {
  const location           = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/businesses/:websiteId" element={<BusinessDetail />} />

        {/* Auth */}
        {/* ── Public ───────────────────────────────────────────────────── */}
        <Route path="/" element={<Home />} />
        <Route path="/businesses/:websiteId" element={<BusinessDetail />} />
        <Route path="/auth/callback"         element={<GoogleCallback />} />

        {/* Auth — both /login and /register serve the unified Auth component */}
        <Route path="/login"    element={<Auth />} />
        <Route path="/register" element={<Auth />} />

        {/* Protected */}
        {/* ── Protected ────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          {/* User pages */}
          <Route path="/account" element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/dashboard/listings/new"
            element={<ListingForm />}
          />
          <Route
            path="/dashboard/listings/:websiteId/edit"
          <Route path="/dashboard/listings/new" element={<ListingForm />} />
          <Route path="/dashboard/listings/:websiteId/edit"
            element={<ListingForm />}
          />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/:websiteId" element={<Analytics />} />
          <Route path="/subscribe/:websiteId" element={<Subscribe />} />
          <Route path="/subscriptions" element={<Subscriptions />} />

          {/* Admin */}
          {/* ── Admin ──────────────────────────────────────────────────── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route
              index
              element={<Navigate to="/admin/dashboard" replace />}
            />

            <Route
              path="dashboard"
              element={<AdminDashboard />}
            />

            <Route
              path="analytics"
              element={<AdminAnalysis />}
            />

            <Route
              path="subscriptions"
              element={<AdminSubscriptions />}
            />

            <Route
              path="categories"
              element={<Categories />}
            />

            <Route
              path="domains"
              element={<Domains />}
            />

            <Route
              path="websites"
              element={<AdminWebsites />}
            />

            <Route
              path="users"
              element={<Users />}
            />
          </Route>
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      {/* ── Modal overlay (only when backgroundLocation is set) ─────── */}
      {backgroundLocation && (
        <Routes>
          <Route path="/login"    element={<Auth />} />
          <Route path="/register" element={<Auth />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthModalLayer />
    </BrowserRouter>
  );
}

export default App;
