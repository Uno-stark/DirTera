import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

// Public pages
import Home from "./pages/Home";
import BusinessDetail from "./pages/BusinessDetail";

// User pages
import Login from "./pages/User/Login";
import Register from "./pages/User/Register";
import GoogleCallback from "./pages/User/GoogleCallback";
import Account from "./pages/User/Account";
import Dashboard from "./pages/User/Dashboard";
import ListingForm from "./pages/User/ListingForm";
import Notifications from "./pages/User/Notifications";
import Analytics from "./pages/User/Analytics";
import Subscribe from "./pages/User/Subscribe";
import Subscriptions from "./pages/User/Subscriptions";

// Admin pages
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import Categories from "./pages/Admin/Categories";
import Domains from "./pages/Admin/Domains";
import AdminWebsites from "./pages/Admin/Websites";
import Users from "./pages/Admin/Users";

// Shared
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ───────────────────────────────────────────────────── */}
        <Route path="/" element={<Home />} />
        <Route path="/businesses/:websiteId" element={<BusinessDetail />} />

        {/* ── Auth ─────────────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<GoogleCallback />} />

        {/* ── Protected ────────────────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/listings/new" element={<ListingForm />} />
          <Route path="/dashboard/listings/:websiteId/edit"
            element={<ListingForm />}
          />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/:websiteId" element={<Analytics />} />
          <Route path="/subscribe/:websiteId" element={<Subscribe />} />
          <Route path="/subscriptions" element={<Subscriptions />} />

          {/* ── Admin ──────────────────────────────────────────────────── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="categories" element={<Categories />} />
            <Route path="domains" element={<Domains />} />
            <Route path="websites" element={<AdminWebsites />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
