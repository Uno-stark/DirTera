import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/Account";
import BusinessDetail from "./pages/BusinessDetail";
import ProtectedRoute from "./components/ProtectedRoute";
import GoogleCallback from "./pages/GoogleCallback";
import Dashboard from "./pages/Dashboard";
import ListingForm from "./pages/ListingForm";

import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import Categories from "./pages/Admin/Categories";
import Domains from "./pages/Admin/Domains";
import AdminWebsites from "./pages/Admin/Websites";
import Users from "./pages/Admin/Users";
import AdminAnalysis from "./pages/Admin/AdminAnalytics";
import AdminSubscriptions from "./pages/Admin/AdminSubscriptions";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<Home />} />

        <Route
          path="/businesses/:websiteId"
          element={<BusinessDetail />}
        />

        {/* ================= AUTH ================= */}
        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/auth/callback"
          element={<GoogleCallback />}
        />

        {/* ================= PROTECTED ================= */}
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
            element={<ListingForm />}
          />

          {/* ================= ADMIN ================= */}
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

        {/* ================= FALLBACK ================= */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
