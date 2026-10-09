import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, ShieldCheck, ShieldOff } from "lucide-react";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";

const PAGE_SIZE = 20;

/* ── Query key factory ───────────────────────────────────────────────────── */
const userKeys = {
  list: (search, page) => ["admin", "users", { search, page }],
};

/* ── Data fetcher ─────────────────────────────────────────────────────────── */
async function fetchUsers({ search, page }) {
  const params = { page, page_size: PAGE_SIZE };
  if (search) params.search = search;
  const { data } = await api.get("/api/v1/users", { params });
  const items = data.items ?? data;
  return {
    items,
    total:       data.total       ?? items.length,
    totalPages:  data.total_pages ?? 1,
  };
}

/* ── Toggle ──────────────────────────────────────────────────────────────── */
function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`toggle-track${on ? " on" : ""}`}
      onClick={() => !disabled && onChange(!on)}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRows({ count = 10 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 130 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 180 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 30, borderRadius: 999 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 70, height: 24, borderRadius: 5 }} /></td>
    </tr>
  ));
}

/* ── Pagination ──────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, total);
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) pages.push(p);
  }
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">{start}–{end} of {total.toLocaleString()}</span>
      <div className="admin-pagination-btns">
        <button className="admin-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.flatMap((p, i, arr) => {
          const btn = (
            <button
              key={p}
              className={`admin-page-btn${p === page ? " active" : ""}`}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          );
          return i > 0 && p - arr[i - 1] > 1
            ? [<span key={`e${p}`} style={{ padding: "0 2px", color: "#9ca3af", fontSize: 12 }}>…</span>, btn]
            : [btn];
        })}
        <button className="admin-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function Users() {
  const { toasts, toast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page,       setPage]       = useState(1);
  const [updatingId, setUpdatingId] = useState(null);

  /* Query */
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: userKeys.list(search, page),
    queryFn:  () => fetchUsers({ search, page }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,  // keep previous page visible while fetching next
    retry: 1,
  });

  const users      = data?.items      ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  /* Prefetch next page */
  if (page < totalPages) {
    queryClient.prefetchQuery({
      queryKey: userKeys.list(search, page + 1),
      queryFn:  () => fetchUsers({ search, page: page + 1 }),
      staleTime: 30_000,
    });
  }

  /* Debounced search — commit after 350 ms of no typing */
  const debounceRef = useState(() => ({ current: null }))[0];

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setDraftSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const clearSearch = () => {
    setDraftSearch("");
    setSearch("");
    setPage(1);
  };

  /* Optimistic PATCH helper */
  const adminPatch = useCallback(async (user, patch, successMsg) => {
    setUpdatingId(user.id);

    // Optimistic update — mutate the cached page immediately
    queryClient.setQueryData(userKeys.list(search, page), (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((u) => u.id === user.id ? { ...u, ...patch } : u),
      };
    });

    try {
      const { data: updated } = await api.patch(`/api/v1/users/${user.id}/admin`, patch);
      // Merge server response into cache (handles any server-side normalisation)
      queryClient.setQueryData(userKeys.list(search, page), (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((u) => u.id === user.id ? { ...u, ...updated } : u),
        };
      });
      toast(successMsg);
    } catch (err) {
      // Rollback — re-fetch the true state
      queryClient.invalidateQueries({ queryKey: userKeys.list(search, page) });
      toast(err.response?.data?.detail || "Failed to update user.", "error");
    } finally {
      setUpdatingId(null);
    }
  }, [queryClient, search, page, toast]);

  const toggleActive = (user) => {
    const next = !user.is_active;
    adminPatch(
      user,
      { is_active: next },
      next
        ? `${user.full_name || user.email} reactivated.`
        : `${user.full_name || user.email} deactivated.`,
    );
  };

  const toggleAdmin = (user) => {
    const next = !user.is_admin;
    adminPatch(
      user,
      { is_admin: next },
      next
        ? `${user.full_name || user.email} is now an admin.`
        : `${user.full_name || user.email} is now a regular user.`,
    );
  };

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          {!isLoading && (
            <p className="admin-subtitle">
              {total.toLocaleString()} user{total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <div className="admin-error" style={{ marginBottom: 14 }}>
          Failed to load users.
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-wrap">
          <Search size={13} className="admin-search-icon" />
          <input
            type="search"
            className="admin-search"
            placeholder="Search by name or email…"
            value={draftSearch}
            onChange={handleSearchChange}
          />
          {draftSearch && (
            <button className="admin-search-clear" onClick={clearSearch} aria-label="Clear">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Subtle "loading more" indicator */}
        {isFetching && !isLoading && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Updating…</span>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Active</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={10} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <p className="admin-empty">
                      {search ? `No users matching "${search}".` : "No users found."}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={u.is_active ? "" : "row-inactive"}>
                    <td style={{ fontWeight: 500, color: "#111827" }}>
                      {u.full_name || <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{u.email}</td>
                    <td>
                      <Toggle
                        on={u.is_active}
                        onChange={() => toggleActive(u)}
                        disabled={updatingId === u.id}
                      />
                    </td>
                    <td>
                      <button
                        className={`admin-role-btn${u.is_admin ? " is-admin" : " not-admin"}`}
                        disabled={updatingId === u.id}
                        onClick={() => toggleAdmin(u)}
                        title={u.is_admin ? "Click to remove admin role" : "Click to make admin"}
                      >
                        {u.is_admin
                          ? <><ShieldCheck size={12} /> Admin</>
                          : <><ShieldOff  size={12} /> User</>}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      </div>
    </div>
  );
}

export default Users;
