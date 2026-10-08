import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import PageLoader from "./components/PageLoader";

// ── Public pages ──────────────────────────────────────────────────────────────
const Home           = lazy(() => import("./pages/Home"));
const BusinessDetail = lazy(() => import("./pages/BusinessDetail"));
const Legal          = lazy(() => import("./pages/Legal"));
const DomainIndex    = lazy(() => import("./pages/DomainIndex"));

// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth           = lazy(() => import("./pages/User/Auth"));
const GoogleCallback = lazy(() => import("./pages/User/GoogleCallback"));

// ── User pages ────────────────────────────────────────────────────────────────
const Account    = lazy(() => import("./pages/User/Account"));
const Dashboard  = lazy(() => import("./pages/User/Dashboard"));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminLayout        = lazy(() => import("./pages/Admin/AdminLayout"));
const AdminDashboard     = lazy(() => import("./pages/Admin/AdminDashboard"));
const Categories         = lazy(() => import("./pages/Admin/Categories"));
const Domains            = lazy(() => import("./pages/Admin/Domains"));
const AdminWebsites      = lazy(() => import("./pages/Admin/Websites"));
const Users              = lazy(() => import("./pages/Admin/Users"));
const AdminAnalysis      = lazy(() => import("./pages/Admin/AdminAnalytics"));
const AdminSubscriptions = lazy(() => import("./pages/Admin/AdminSubscriptions"));

// ── Shared ────────────────────────────────────────────────────────────────────
import ProtectedRoute from "./components/ProtectedRoute";

function AuthModalLayer() {
  const location           = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <>
      {/* ── Main routes (stay mounted while modal is open) ─────────── */}
      <Routes location={backgroundLocation || location}>
        <Route path="/"                      element={<Home />} />
        <Route path="/businesses/:websiteId" element={<BusinessDetail />} />
        <Route path="/domain/:domainSlug"    element={<DomainIndex />} />
        <Route path="/auth/callback"         element={<GoogleCallback />} />
        <Route path="/legal/:type"           element={<Legal />} />

        {/* Auth — both /login and /register serve the unified Auth component */}
        <Route path="/login"    element={<Auth />} />
        <Route path="/register" element={<Auth />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>

          {/* User pages */}
          <Route path="/account"   element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"     element={<AdminDashboard />} />
            <Route path="analytics"     element={<AdminAnalysis />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="categories"    element={<Categories />} />
            <Route path="domains"       element={<Domains />} />
            <Route path="websites"      element={<AdminWebsites />} />
            <Route path="users"         element={<Users />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ── Modal overlay ─────── */}
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
      <Suspense fallback={<PageLoader />}>
        <AuthModalLayer />
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
