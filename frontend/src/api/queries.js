import api from "./client";

// ── Query key factory ─────────────────────────────────────────────────────────
export const keys = {
  categories:      ()            => ["categories"],
  categoriesNav:   ()            => ["categories", "with-domains"],
  websites:        (params)      => ["websites", params],
  websiteDetail:   (id)          => ["websites", id],
  premiered:       (params)      => ["websites", "premiered", params],
  topWebsites:     (params)      => ["websites", "top", params],
  domainWebsites:  (slug, params)=> ["domain", slug, params],
  reviews:         (id, page)    => ["reviews", id, page],
  analyticsStats:  (id, params)  => ["analytics", id, params],
  analyticsBulk:   (params)      => ["analytics", "bulk", params],
  myListings:      ()            => ["websites", "my"],
  adminAll:        (params)      => ["admin", "websites", params],
  notifications:   (page)        => ["notifications", page],
  notifCount:      ()            => ["notifications", "count"],
  plans:           ()            => ["payments", "plans"],
  subscriptions:   ()            => ["payments", "subscriptions"],
  paymentHealth:   ()            => ["payments", "health"],
};


export async function fetchCategoriesNav() {
  const { data } = await api.get("/api/v1/categories/with-domains");
  return data;
}

export async function fetchFeatured(params) {
  const { data } = await api.get("/api/v1/websites/premiered", { params });
  return data;
}

export async function fetchTopWebsites(params) {
  const { data } = await api.get("/api/v1/websites/top", { params });
  return data;
}

export async function fetchWebsites(params) {
  const { data } = await api.get("/api/v1/websites", { params });
  return data;
}

export async function fetchDomainWebsites({ domainSlug, filter, page, pageSize }) {
  const endpoint =
    filter === "premiered" ? "/api/v1/websites/premiered" : "/api/v1/websites";
  const { data } = await api.get(endpoint, {
    params: { page, page_size: pageSize, domain: domainSlug, sort_by: "rating" },
  });
  return data;
}

export async function fetchWebsiteDetail(id) {
  const { data } = await api.get(`/api/v1/websites/${id}`);
  return data;
}

export async function fetchReviews(websiteId, page, pageSize = 5) {
  const { data } = await api.get(`/api/v1/reviews/${websiteId}`, {
    params: { page, page_size: pageSize },
  });
  return data;
}

export async function fetchAnalyticsStats(id, params) {
  const { data } = await api.get(`/api/v1/analytics/${id}/stats`, { params });
  return data;
}

export async function fetchMyListings() {
  const { data } = await api.get("/api/v1/websites/my");
  return data;
}

export async function fetchAdminAll(params) {
  const { data } = await api.get("/api/v1/websites/admin/all", { params });
  return data;
}

export async function fetchBulkStats({ websiteIds, startDate, endDate }) {
  const { data } = await api.post("/api/v1/analytics/bulk-stats", {
    website_ids: websiteIds,
    ...(startDate && { start_date: startDate }),
    ...(endDate   && { end_date:   endDate   }),
  });
  return data.stats;
}

export async function fetchPlans() {
  const { data } = await api.get("/api/v1/payments/plans");
  return data;
}

export async function fetchSubscriptions() {
  const { data } = await api.get("/api/v1/payments/subscriptions");
  return data;
}

export async function fetchPaymentHealth() {
  const { data } = await api.get("/api/v1/payments/health", { timeout: 10_000 });
  return data;
}
