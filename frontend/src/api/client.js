import axios from "axios";


const CACHE_TTL = 30_000;          // 30 s — fresh enough, avoids thundering herd
const cache     = new Map();       // url+params → { data, ts }
const inflight  = new Map();       // url+params → Promise

function cacheKey(url, params) {
  return params && Object.keys(params).length
    ? `${url}?${new URLSearchParams(params).toString()}`
    : url;
}

function isFresh(entry) {
  return entry && Date.now() - entry.ts < CACHE_TTL;
}

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,   // 15 s hard timeout — fail fast instead of hanging forever
});

// Attach bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Cached GET helper ───────────────────────────────────────────────────────
// Use this instead of api.get() for read-only, cacheable endpoints.
// For mutations (POST/PATCH/DELETE) keep using api directly.
export function cachedGet(url, params, options = {}) {
  const key = cacheKey(url, params);

  // Return cached value if still fresh
  const entry = cache.get(key);
  if (!options.force && isFresh(entry)) {
    return Promise.resolve({ data: entry.data, fromCache: true });
  }

  // Deduplicate in-flight requests
  if (inflight.has(key)) return inflight.get(key);

  const req = api
    .get(url, { params })
    .then((res) => {
      cache.set(key, { data: res.data, ts: Date.now() });
      inflight.delete(key);
      return { data: res.data, fromCache: false };
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, req);
  return req;
}

// Bust a cached entry (call after mutations that affect listed data)
export function bustCache(url, params) {
  const key = cacheKey(url, params);
  cache.delete(key);
}

// Bust all cache entries whose key starts with a prefix
export function bustCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export default api;