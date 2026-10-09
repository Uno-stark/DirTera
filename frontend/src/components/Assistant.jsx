"use client";

import { VoxideClient, VoxideWidget } from "@voxide/react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

// Publishable key — safe to ship in the browser
// TODO: Replace with your actual Voxide publishable key from the dashboard
const ai = new VoxideClient({ 
  publicKey: "vox_pub_abe2a63b5233efc9184d9700ccc2a2c74111fa943c07cf42",
  ui: {
    hotkeyActivate: "alt+k", // User can press Alt+K to start voice session
  }
});

// ── Register capabilities ─────────────────────────────────────────────────────
// These are the actions users can ask for by voice or text

ai.register({
  searchBusinesses: {
    description: "Search for businesses or websites by name, category, or domain. Returns matching business listings.",
    params: {
      query: { type: "string", required: true },
      category: { type: "string", required: false },
      domain: { type: "string", required: false },
      page: { type: "number", required: false },
    },
    handler: async ({ query, category, domain, page = 1 }) => {
      try {
        const params = {
          search: query,
          page,
          page_size: 10,
        };
        if (category) params.category = category;
        if (domain) params.domain = domain;
        
        const { data } = await api.get("/api/v1/websites", { params });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `Found ${data.total} businesses matching "${query}".`,
            results: data.items.map(b => ({
              id: b.id,
              name: b.name,
              description: b.description,
              rating: b.average_rating,
              url: b.url,
            })),
          };
        }
        return { success: true, message: `No businesses found matching "${query}".` };
      } catch (error) {
        return { success: false, message: "Failed to search businesses." };
      }
    },
  },

  viewBusiness: {
    description: "Navigate to a specific business detail page by business ID.",
    params: {
      businessId: { type: "number", required: true },
    },
    handler: async ({ businessId }) => {
      // This will be handled by the navigation helper after registration
      return { 
        success: true, 
        navigate: `/businesses/${businessId}`,
        message: `Opening business details...`
      };
    },
  },

  browseCategory: {
    description: "Browse businesses by category or domain. Use this when user wants to see all businesses in a specific category.",
    params: {
      domainSlug: { type: "string", required: true },
    },
    handler: async ({ domainSlug }) => {
      return { 
        success: true, 
        navigate: `/domain/${domainSlug}`,
        message: `Browsing ${domainSlug} businesses...`
      };
    },
  },

  goToHome: {
    description: "Go to the home page / main page of the website.",
    params: {},
    handler: async () => {
      return { 
        success: true, 
        navigate: "/",
        message: "Going to home page..."
      };
    },
  },

  goToDashboard: {
    description: "Go to the user's dashboard where they can manage their business listings.",
    params: {},
    handler: async () => {
      return { 
        success: true, 
        navigate: "/dashboard",
        message: "Opening your dashboard..."
      };
    },
  },

  goToAccount: {
    description: "Go to account settings page where user can manage their profile.",
    params: {},
    handler: async () => {
      return { 
        success: true, 
        navigate: "/account",
        message: "Opening account settings..."
      };
    },
  },

  login: {
    description: "Navigate to the login page.",
    params: {},
    handler: async () => {
      return { 
        success: true, 
        navigate: "/login",
        message: "Opening login page..."
      };
    },
  },

  logout: {
    description: "Log out the current user.",
    params: {},
    dangerous: true, // Prompts user for confirmation
    handler: async () => {
      // This will be handled by the logout helper after registration
      return { 
        success: true,
        action: "logout",
        message: "Logging out..."
      };
    },
  },

  submitReview: {
    description: "Submit a review for a business. Requires rating (1-5) and optional text comment.",
    params: {
      businessId: { type: "number", required: true },
      rating: { type: "number", required: true },
      comment: { type: "string", required: false },
    },
    dangerous: true,
    handler: async ({ businessId, rating, comment }) => {
      try {
        await api.post(`/api/v1/reviews/${businessId}`, {
          rating,
          comment: comment || "",
        });
        return { 
          success: true, 
          message: `Review submitted successfully! Rated ${rating}/5.`
        };
      } catch (error) {
        return { 
          success: false, 
          message: "Failed to submit review. You may need to be logged in."
        };
      }
    },
  },

  getFeaturedBusinesses: {
    description: "Get the list of featured or premiered businesses on the platform.",
    params: {
      limit: { type: "number", required: false },
    },
    handler: async ({ limit = 10 }) => {
      try {
        const { data } = await api.get("/api/v1/websites/premiered", {
          params: { page: 1, page_size: limit },
        });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `Here are ${data.items.length} featured businesses:`,
            results: data.items.map(b => ({
              id: b.id,
              name: b.name,
              description: b.description,
              rating: b.average_rating,
            })),
          };
        }
        return { success: true, message: "No featured businesses at the moment." };
      } catch (error) {
        return { success: false, message: "Failed to fetch featured businesses." };
      }
    },
  },

  getTopRatedBusinesses: {
    description: "Get the highest-rated businesses on the platform.",
    params: {
      limit: { type: "number", required: false },
    },
    handler: async ({ limit = 10 }) => {
      try {
        const { data } = await api.get("/api/v1/websites/top", {
          params: { page: 1, page_size: limit },
        });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `Here are the top ${data.items.length} rated businesses:`,
            results: data.items.map(b => ({
              id: b.id,
              name: b.name,
              rating: b.average_rating,
              reviewCount: b.review_count,
            })),
          };
        }
        return { success: true, message: "No rated businesses found." };
      } catch (error) {
        return { success: false, message: "Failed to fetch top-rated businesses." };
      }
    },
  },

  getMyListings: {
    description: "Get the current user's business listings that they own or manage.",
    params: {},
    scope: "/dashboard", // Only available on dashboard route
    handler: async () => {
      try {
        const { data } = await api.get("/api/v1/websites/my");
        
        if (data && data.length > 0) {
          return {
            success: true,
            message: `You have ${data.length} business listing(s).`,
            results: data.map(b => ({
              id: b.id,
              name: b.name,
              status: b.status,
              clicks: b.click_count,
            })),
          };
        }
        return { success: true, message: "You don't have any business listings yet." };
      } catch (error) {
        return { success: false, message: "Failed to fetch your listings. Make sure you're logged in." };
      }
    },
  },

  // ── Analytics Capabilities ──────────────────────────────────────────────────

  getAnalyticsSummary: {
    description: "Get analytics summary for a business listing including total clicks, today's clicks, and top referrers.",
    params: {
      businessId: { type: "number", required: true },
    },
    handler: async ({ businessId }) => {
      try {
        const { data } = await api.get(`/api/v1/analytics/${businessId}/summary`);
        return {
          success: true,
          message: `Analytics for listing ${businessId}:`,
          summary: {
            totalClicks: data.total_clicks,
            clicksToday: data.clicks_today,
            clicksLast7Days: data.clicks_last_7_days,
            clicksLast30Days: data.clicks_last_30_days,
            topReferrers: data.top_referrers?.slice(0, 3),
            topCountries: data.clicks_by_country?.slice(0, 3),
          },
        };
      } catch (error) {
        return { success: false, message: "Failed to fetch analytics. You may not have permission." };
      }
    },
  },

  getClickStats: {
    description: "Get daily click statistics for a business listing over a date range.",
    params: {
      businessId: { type: "number", required: true },
      startDate: { type: "string", required: false },
      endDate: { type: "string", required: false },
    },
    handler: async ({ businessId, startDate, endDate }) => {
      try {
        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        
        const { data } = await api.get(`/api/v1/analytics/${businessId}/stats`, { params });
        
        const recentData = data.data?.slice(-7) || [];
        return {
          success: true,
          message: `Click statistics for ${data.website_name}:`,
          totalClicks: data.total_clicks,
          recentDays: recentData,
        };
      } catch (error) {
        return { success: false, message: "Failed to fetch click statistics." };
      }
    },
  },

  exportAnalytics: {
    description: "Export analytics data as CSV for a business listing.",
    params: {
      businessId: { type: "number", required: true },
    },
    dangerous: true,
    handler: async ({ businessId }) => {
      try {
        // Note: This would trigger a download in the browser
        const response = await api.get(`/api/v1/analytics/${businessId}/export`, {
          responseType: 'blob',
        });
        
        // Trigger download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `clicks_${businessId}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        return { success: true, message: "Analytics CSV downloaded successfully!" };
      } catch (error) {
        return { success: false, message: "Failed to export analytics." };
      }
    },
  },

  // ── Subscription & Payment Capabilities ─────────────────────────────────────

  viewPlans: {
    description: "View available subscription plans with pricing and features.",
    params: {},
    handler: async () => {
      try {
        const { data } = await api.get("/api/v1/payments/plans");
        
        if (data && data.length > 0) {
          return {
            success: true,
            message: `Here are the available plans:`,
            plans: data.map(p => ({
              slug: p.slug,
              label: p.label,
              description: p.description,
              price: `${p.amount} ${p.currency}`,
              duration: `${p.duration_days} days`,
              isPremier: p.is_premiered,
            })),
          };
        }
        return { success: true, message: "No plans available at the moment." };
      } catch (error) {
        return { success: false, message: "Failed to fetch plans." };
      }
    },
  },

  getSubscriptionInfo: {
    description: "Get subscription pricing information for a specific business and plan before payment.",
    params: {
      businessId: { type: "number", required: true },
      planSlug: { type: "string", required: true },
    },
    handler: async ({ businessId, planSlug }) => {
      try {
        const { data } = await api.get("/api/v1/payments/subscribe/info", {
          params: { website_id: businessId, plan: planSlug },
        });
        
        return {
          success: true,
          message: `Subscription details:`,
          info: {
            businessName: data.website_name,
            plan: data.label,
            amount: `${data.amount} ${data.currency}`,
            duration: `${data.duration_days} days`,
            isPremier: data.is_premiered,
          },
        };
      } catch (error) {
        return { success: false, message: "Failed to get subscription info." };
      }
    },
  },

  viewMySubscriptions: {
    description: "View all active and past subscriptions for the current user.",
    params: {},
    handler: async () => {
      try {
        const { data } = await api.get("/api/v1/payments/subscriptions");
        
        if (data && data.length > 0) {
          return {
            success: true,
            message: `You have ${data.length} subscription(s).`,
            subscriptions: data.map(s => ({
              businessId: s.website_id,
              plan: s.plan,
              status: s.status,
              amount: `${s.amount} ${s.currency}`,
              expiresAt: s.expires_at,
            })),
          };
        }
        return { success: true, message: "You don't have any subscriptions yet." };
      } catch (error) {
        return { success: false, message: "Failed to fetch subscriptions." };
      }
    },
  },

  // ── Notification Capabilities ───────────────────────────────────────────────

  viewNotifications: {
    description: "View your notifications from the platform about listing approvals, rejections, etc.",
    params: {
      unreadOnly: { type: "boolean", required: false },
    },
    handler: async ({ unreadOnly = false }) => {
      try {
        const { data } = await api.get("/api/v1/notifications", {
          params: { unread_only: unreadOnly, page: 1, page_size: 10 },
        });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `You have ${data.total} notification(s).`,
            notifications: data.items.map(n => ({
              id: n.id,
              title: n.title,
              body: n.body,
              isRead: n.is_read,
              createdAt: n.created_at,
            })),
          };
        }
        return { success: true, message: "No notifications." };
      } catch (error) {
        return { success: false, message: "Failed to fetch notifications." };
      }
    },
  },

  markAllNotificationsRead: {
    description: "Mark all notifications as read.",
    params: {},
    handler: async () => {
      try {
        await api.patch("/api/v1/notifications/read-all");
        return { success: true, message: "All notifications marked as read." };
      } catch (error) {
        return { success: false, message: "Failed to mark notifications as read." };
      }
    },
  },

  markNotificationRead: {
    description: "Mark a specific notification as read.",
    params: {
      notificationId: { type: "string", required: true },
    },
    handler: async ({ notificationId }) => {
      try {
        await api.patch(`/api/v1/notifications/${notificationId}/read`);
        return { success: true, message: "Notification marked as read." };
      } catch (error) {
        return { success: false, message: "Failed to mark notification as read." };
      }
    },
  },

  // ── Category & Domain Capabilities ──────────────────────────────────────────

  listCategories: {
    description: "List all available business categories on the platform.",
    params: {},
    handler: async () => {
      try {
        const { data } = await api.get("/api/v1/categories");
        
        if (data && data.length > 0) {
          return {
            success: true,
            message: `Here are the available categories:`,
            categories: data.map(c => ({
              slug: c.slug,
              name: c.name,
              icon: c.icon,
              description: c.description,
            })),
          };
        }
        return { success: true, message: "No categories found." };
      } catch (error) {
        return { success: false, message: "Failed to fetch categories." };
      }
    },
  },

  listDomains: {
    description: "List all domains (industry niches) optionally filtered by category.",
    params: {
      categorySlug: { type: "string", required: false },
    },
    handler: async ({ categorySlug }) => {
      try {
        const params = {};
        if (categorySlug) params.category_slug = categorySlug;
        
        const { data } = await api.get("/api/v1/domains", { params });
        
        if (data && data.length > 0) {
          return {
            success: true,
            message: categorySlug 
              ? `Domains in ${categorySlug}:` 
              : "Here are all available domains:",
            domains: data.map(d => ({
              slug: d.slug,
              name: d.name,
              icon: d.icon,
              category: d.category_slug,
            })),
          };
        }
        return { success: true, message: "No domains found." };
      } catch (error) {
        return { success: false, message: "Failed to fetch domains." };
      }
    },
  },

  // ── Business Management Capabilities ────────────────────────────────────────

  createListing: {
    description: "Create a new business listing. Requires business name, URL, description, category, and domain.",
    params: {
      name: { type: "string", required: true },
      url: { type: "string", required: true },
      shortDescription: { type: "string", required: true },
      categorySlug: { type: "string", required: true },
      domainSlug: { type: "string", required: true },
      tags: { type: "string", required: false },
    },
    dangerous: true,
    handler: async ({ name, url, shortDescription, categorySlug, domainSlug, tags }) => {
      try {
        const { data } = await api.post("/api/v1/websites", {
          name,
          url,
          short_description: shortDescription,
          category_slug: categorySlug,
          domain_slug: domainSlug,
          tags: tags || "",
        });
        
        return {
          success: true,
          message: `Business listing "${name}" created successfully! It's now pending admin approval.`,
          listingId: data.id,
        };
      } catch (error) {
        return { success: false, message: "Failed to create listing. Make sure all fields are valid." };
      }
    },
  },

  updateListing: {
    description: "Update an existing business listing. You must be the owner.",
    params: {
      businessId: { type: "number", required: true },
      name: { type: "string", required: false },
      url: { type: "string", required: false },
      shortDescription: { type: "string", required: false },
      fullDescription: { type: "string", required: false },
      tags: { type: "string", required: false },
    },
    dangerous: true,
    handler: async ({ businessId, name, url, shortDescription, fullDescription, tags }) => {
      try {
        const updates = {};
        if (name) updates.name = name;
        if (url) updates.url = url;
        if (shortDescription) updates.short_description = shortDescription;
        if (fullDescription) updates.full_description = fullDescription;
        if (tags) updates.tags = tags;
        
        await api.patch(`/api/v1/websites/${businessId}`, updates);
        
        return {
          success: true,
          message: "Business listing updated successfully! Changes may need admin re-approval.",
        };
      } catch (error) {
        return { success: false, message: "Failed to update listing. You may not have permission." };
      }
    },
  },

  deleteListing: {
    description: "Delete a business listing permanently. You must be the owner.",
    params: {
      businessId: { type: "number", required: true },
    },
    dangerous: true,
    handler: async ({ businessId }) => {
      try {
        await api.delete(`/api/v1/websites/${businessId}`);
        return {
          success: true,
          message: "Business listing deleted successfully.",
          navigate: "/dashboard",
        };
      } catch (error) {
        return { success: false, message: "Failed to delete listing. You may not have permission." };
      }
    },
  },

  // ── Review Management ───────────────────────────────────────────────────────

  viewReviews: {
    description: "View reviews for a specific business listing.",
    params: {
      businessId: { type: "number", required: true },
      page: { type: "number", required: false },
    },
    handler: async ({ businessId, page = 1 }) => {
      try {
        const { data } = await api.get(`/api/v1/reviews/${businessId}`, {
          params: { page, page_size: 5 },
        });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `Reviews for business (page ${page}):`,
            total: data.total,
            reviews: data.items.map(r => ({
              id: r.id,
              rating: r.rating,
              body: r.body,
              authorName: r.author_name,
              createdAt: r.created_at,
            })),
          };
        }
        return { success: true, message: "No reviews yet for this business." };
      } catch (error) {
        return { success: false, message: "Failed to fetch reviews." };
      }
    },
  },

  updateReview: {
    description: "Update your own review for a business.",
    params: {
      reviewId: { type: "string", required: true },
      rating: { type: "number", required: false },
      comment: { type: "string", required: false },
    },
    dangerous: true,
    handler: async ({ reviewId, rating, comment }) => {
      try {
        const updates = {};
        if (rating) updates.rating = rating;
        if (comment) updates.body = comment;
        
        await api.patch(`/api/v1/reviews/${reviewId}`, updates);
        return { success: true, message: "Review updated successfully!" };
      } catch (error) {
        return { success: false, message: "Failed to update review. You may not be the author." };
      }
    },
  },

  deleteReview: {
    description: "Delete your own review.",
    params: {
      reviewId: { type: "string", required: true },
    },
    dangerous: true,
    handler: async ({ reviewId }) => {
      try {
        await api.delete(`/api/v1/reviews/${reviewId}`);
        return { success: true, message: "Review deleted successfully." };
      } catch (error) {
        return { success: false, message: "Failed to delete review. You may not be the author." };
      }
    },
  },

  // ── Admin Capabilities (only for admin users) ───────────────────────────────

  viewAdminDashboard: {
    description: "View platform-wide statistics and metrics. Admin only.",
    params: {},
    scope: "/admin/*",
    handler: async () => {
      try {
        const { data } = await api.get("/api/v1/admin/dashboard");
        return {
          success: true,
          message: "Platform statistics:",
          stats: {
            users: data.users,
            websites: data.websites,
            subscriptions: data.subscriptions,
            taxonomy: data.taxonomy,
            plans: data.plans,
          },
        };
      } catch (error) {
        return { success: false, message: "Failed to fetch admin dashboard. Admin access required." };
      }
    },
  },

  viewPendingListings: {
    description: "View business listings pending admin approval. Admin only.",
    params: {
      page: { type: "number", required: false },
    },
    scope: "/admin/*",
    handler: async ({ page = 1 }) => {
      try {
        const { data } = await api.get("/api/v1/admin/requests", {
          params: { page, page_size: 10 },
        });
        
        if (data.items && data.items.length > 0) {
          return {
            success: true,
            message: `${data.total} listing(s) pending approval:`,
            listings: data.items.map(l => ({
              id: l.id,
              name: l.name,
              url: l.url,
              owner: l.owner_email,
              submittedAt: l.created_at,
            })),
          };
        }
        return { success: true, message: "No pending listings." };
      } catch (error) {
        return { success: false, message: "Failed to fetch pending listings. Admin access required." };
      }
    },
  },

  approveListing: {
    description: "Approve a pending business listing. Admin only.",
    params: {
      businessId: { type: "number", required: true },
    },
    dangerous: true,
    scope: "/admin/*",
    handler: async ({ businessId }) => {
      try {
        await api.post(`/api/v1/websites/${businessId}/approve`);
        return { success: true, message: "Business listing approved successfully!" };
      } catch (error) {
        return { success: false, message: "Failed to approve listing. Admin access required." };
      }
    },
  },

  rejectListing: {
    description: "Reject a pending business listing with a reason. Admin only.",
    params: {
      businessId: { type: "number", required: true },
      reason: { type: "string", required: true },
    },
    dangerous: true,
    scope: "/admin/*",
    handler: async ({ businessId, reason }) => {
      try {
        await api.post(`/api/v1/websites/${businessId}/reject`, {
          rejection_message: reason,
        });
        return { success: true, message: "Business listing rejected." };
      } catch (error) {
        return { success: false, message: "Failed to reject listing. Admin access required." };
      }
    },
  },

  goToAdmin: {
    description: "Navigate to the admin dashboard. Admin only.",
    params: {},
    handler: async () => {
      return { 
        success: true, 
        navigate: "/admin/dashboard",
        message: "Opening admin dashboard..."
      };
    },
  },
});

// ── Component setup with navigation and auth ──────────────────────────────────
export function Assistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // Bind live UI state — the agent sees this every turn
  ai.bindState(() => ({
    currentPage: location.pathname,
    isAuthenticated,
    userEmail: user?.email || null,
    userId: user?.id || null,
    isAdmin: user?.is_admin || false,
  }));

  // Enable navigation capability
  ai.enableNavigation({
    push: (path) => navigate(path),
  });

  // Handle special actions from capability responses
  ai.use(async (context, next) => {
    const result = await next();
    
    // Handle navigation from capability response
    if (result?.navigate) {
      navigate(result.navigate);
    }
    
    // Handle logout action
    if (result?.action === "logout") {
      await logout();
      navigate("/");
    }
    
    return result;
  });

  // Set user identity for Voxide analytics
  if (user) {
    ai.setUser({
      userId: String(user.id),
      email: user.email,
    });
  }

  return <VoxideWidget client={ai} />;
}
