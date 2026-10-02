import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import "../../styles/notifications.css";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState("");

  const PAGE_SIZE = 20;

  const loadNotifications = async (currentPage, filterUnread) => {
    setIsLoading(true);
    setError("");

    try {
      const { data } = await api.get("/api/v1/notifications", {
        params: {
          page: currentPage,
          page_size: PAGE_SIZE,
          unread_only: filterUnread,
        },
      });

      setNotifications(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err) {
      setError(
        err.response?.data?.detail || "We couldn't load your notifications."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(page, unreadOnly);
  }, [page, unreadOnly]);

  const handleMarkOne = async (notificationId) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );

    try {
      await api.patch(`/api/v1/notifications/${notificationId}/read`);
    } catch {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: false } : n
        )
      );
    }
  };

  const handleMarkAll = async () => {
    setIsMarkingAll(true);

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await api.patch("/api/v1/notifications/read-all");
    } catch {
      // Reload to get the true state
      loadNotifications(page, unreadOnly);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleFilterToggle = () => {
    setPage(1);
    setUnreadOnly((prev) => !prev);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="notifications-page">
      <div className="notifications-container">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="notifications-header">
          <div>
            <Link to="/dashboard" className="notifications-back-link">
              ← Back to dashboard
            </Link>
            <h1>Notifications</h1>
            <p>
              {total} notification{total !== 1 ? "s" : ""}
              {unreadCount > 0 && ` · ${unreadCount} unread`}
            </p>
          </div>

          <div className="notifications-actions">
            <button
              type="button"
              className={`notifications-filter-button ${unreadOnly ? "active" : ""}`}
              onClick={handleFilterToggle}
            >
              {unreadOnly ? "Show all" : "Unread only"}
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                className="notifications-mark-all-button"
                onClick={handleMarkAll}
                disabled={isMarkingAll}
              >
                {isMarkingAll ? "Marking..." : "Mark all as read"}
              </button>
            )}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="notifications-loading">
            <p>Loading notifications...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="notifications-error" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="notifications-empty">
            <h3>{unreadOnly ? "No unread notifications" : "No notifications yet"}</h3>
            <p>
              {unreadOnly
                ? "You're all caught up."
                : "Notifications about your listings will appear here."}
            </p>
            {unreadOnly && (
              <button
                type="button"
                className="notifications-filter-button"
                onClick={handleFilterToggle}
              >
                Show all notifications
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && notifications.length > 0 && (
          <>
            <ul className="notifications-list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? "unread" : ""}`}
                >
                  <div className="notification-content">
                    {!notification.is_read && (
                      <span className="notification-dot" aria-label="Unread" />
                    )}

                    <div className="notification-body">
                      <p className="notification-title">{notification.title}</p>
                      <p className="notification-text">{notification.body}</p>
                      <time className="notification-time">
                        {formatDate(notification.created_at)}
                      </time>
                    </div>
                  </div>

                  {!notification.is_read && (
                    <button
                      type="button"
                      className="notification-read-button"
                      onClick={() => handleMarkOne(notification.id)}
                      aria-label="Mark as read"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* ── Pagination ─────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="notifications-pagination">
                <button
                  type="button"
                  className="notifications-page-button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>

                <span>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  className="notifications-page-button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default Notifications;
