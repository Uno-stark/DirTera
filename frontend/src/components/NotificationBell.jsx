import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";
import "../styles/notifications.css";

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(
    async (pg = 1, unread = unreadOnly, replace = false) => {
      setLoading(true);
      try {
        const { data } = await api.get("/api/v1/notifications", {
          params: { page: pg, page_size: 20, unread_only: unread },
        });
        setItems((prev) => (replace || pg === 1 ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setTotalPages(data.total_pages);
        setPage(pg);
      } finally {
        setLoading(false);
      }
    },
    [unreadOnly]
  );

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await api.get("/api/v1/notifications", {
        params: { page: 1, page_size: 1, unread_only: true },
      });
      setUnreadCount(data.total);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  // Load notifications when panel opens
  useEffect(() => {
    if (open) fetchNotifications(1, unreadOnly, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkOne = async (id) => {
    try {
      await api.patch(`/api/v1/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await api.patch("/api/v1/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleFilterToggle = (val) => {
    setUnreadOnly(val);
    fetchNotifications(1, val, true);
  };

  const handleLoadMore = () => {
    fetchNotifications(page + 1, unreadOnly, false);
  };

  const visibleItems = unreadOnly ? items.filter((n) => !n.is_read) : items;

  return (
    <div className="notif-wrap" ref={panelRef}>
      <button
        type="button"
        className="notif-bell"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            <div className="notif-panel-actions">
              <button
                type="button"
                className={`notif-filter-btn${unreadOnly ? " active" : ""}`}
                onClick={() => handleFilterToggle(!unreadOnly)}
              >
                {unreadOnly ? "All" : "Unread only"}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-markall-btn"
                  disabled={markingAll}
                  onClick={handleMarkAll}
                >
                  {markingAll ? "Marking…" : "Mark all read"}
                </button>
              )}
            </div>
          </div>

          <ul className="notif-list" role="list">
            {!loading && visibleItems.length === 0 && (
              <li className="notif-empty">
                {unreadOnly ? "No unread notifications." : "No notifications yet."}
              </li>
            )}

            {visibleItems.map((n) => (
              <li
                key={n.id}
                className={`notif-item${n.is_read ? "" : " unread"}`}
              >
                <div className="notif-item-body">
                  <p className="notif-item-title">{n.title}</p>
                  <p className="notif-item-text">{n.body}</p>
                  <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    className="notif-read-btn"
                    aria-label="Mark as read"
                    onClick={() => handleMarkOne(n.id)}
                  >
                    ✓
                  </button>
                )}
              </li>
            ))}

            {loading && (
              <li className="notif-loading">Loading…</li>
            )}
          </ul>

          {!loading && page < totalPages && (
            <button
              type="button"
              className="notif-load-more"
              onClick={handleLoadMore}
            >
              Load more
            </button>
          )}

          {!loading && total > 0 && (
            <div className="notif-panel-footer">
              {total} notification{total !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
