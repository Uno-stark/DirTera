import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import { keys } from "../api/queries";
import { fmtRelative } from "../utils/format";

// ── Shared hook — lets any component read the unread count ────────────────────
export function useNotifCount() {
  const { data } = useQuery({
    queryKey: keys.notifCount(),
    queryFn:  () => api.get("/api/v1/notifications", {
      params: { page: 1, page_size: 1, unread_only: true },
    }).then((r) => r.data.total ?? 0),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data ?? 0;
}

const PAGE_SIZE = 10;

// ── Panel portal ──────────────────────────────────────────────────────────────
function Panel({ anchorRef, onClose, notifications, unreadCount, isLoading,
                 hasMore, onLoadMore, onMarkOne, onMarkAll, isMarkingAll }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const place = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    place();
    window.addEventListener("resize", place, { passive: true });
    return () => window.removeEventListener("resize", place);
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!pos) return null;

  return createPortal(
    <div ref={panelRef} className="notif-panel"
      style={{ top: pos.top, right: pos.right }}
      role="dialog" aria-label="Notifications">
      <div className="notif-panel-header">
        <span className="notif-panel-title">
          Notifications
          {unreadCount > 0 && <span className="notif-panel-badge">{unreadCount}</span>}
        </span>
        {unreadCount > 0 && (
          <button type="button" className="notif-mark-all" onClick={onMarkAll} disabled={isMarkingAll}>
            {isMarkingAll ? "Marking…" : "Mark all read"}
          </button>
        )}
      </div>

      <div className="notif-panel-body">
        {isLoading && notifications.length === 0 && <p className="notif-empty">Loading…</p>}
        {!isLoading && notifications.length === 0 && <p className="notif-empty">You're all caught up.</p>}

        {notifications.map((n) => (
          <div key={n.id} className={`notif-item${n.is_read ? "" : " notif-item-unread"}`}>
            <div className="notif-item-body">
              {!n.is_read && <span className="notif-dot" aria-hidden="true" />}
              <div className="notif-item-text">
                <p className="notif-item-title">{n.title}</p>
                {n.body && <p className="notif-item-sub">{n.body}</p>}
                <time className="notif-item-time">{fmtRelative(n.created_at)}</time>
              </div>
            </div>
            {!n.is_read && (
              <button type="button" className="notif-read-btn"
                onClick={() => onMarkOne(n.id)}
                aria-label="Mark as read" title="Mark as read">✓</button>
            )}
          </div>
        ))}

        {hasMore && (
          <button type="button" className="notif-load-more" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
// externalOpen / onExternalClose — optional: lets a parent (UserMenu) drive
// the open state without showing the bell button itself.
// anchorOverride — optional ref to position the panel against a different element
function NotificationPanel({ externalOpen, onExternalClose, hideBell = false, anchorOverride }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [page,         setPage]         = useState(1);
  const [allItems,     setAllItems]     = useState([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const buttonRef  = useRef(null);
  const queryClient = useQueryClient();

  // Use anchorOverride if provided, otherwise fall back to the bell button ref
  const effectiveAnchorRef = anchorOverride || buttonRef;

  // Merge external + internal open state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;

  const unreadCount = useNotifCount();

  // ── Full list (only fetched when panel opens) ─────────────────────────────
  const { data: pageData, isLoading } = useQuery({
    queryKey: keys.notifications(page),
    queryFn:  () => api.get("/api/v1/notifications", {
      params: { page, page_size: PAGE_SIZE },
    }).then((r) => r.data),
    enabled:   open,
    staleTime: 30_000,
  });

  const totalPages = pageData?.total_pages ?? 1;

  // Accumulate pages into allItems
  useEffect(() => {
    if (!pageData?.items) return;
    setAllItems((prev) => page === 1 ? pageData.items : [...prev, ...pageData.items]);
  }, [pageData, page]);

  const toggle = useCallback(() => {
    if (externalOpen !== undefined) return; // driven externally
    setInternalOpen((v) => {
      if (!v) { setPage(1); setAllItems([]); }
      return !v;
    });
  }, [externalOpen]);

  // Reset pagination when opened externally
  useEffect(() => {
    if (externalOpen) { setPage(1); setAllItems([]); }
  }, [externalOpen]);

  const handleClose = useCallback(() => {
    if (externalOpen !== undefined) {
      onExternalClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [externalOpen, onExternalClose]);

  const handleLoadMore = () => setPage((p) => p + 1);

  const handleMarkOne = async (id) => {
    // Capture the item before removing it so we can revert on failure
    const original = allItems.find((n) => n.id === id);
    // Optimistic update — remove from list immediately
    setAllItems((prev) => prev.filter((n) => n.id !== id));
    queryClient.setQueryData(keys.notifCount(), (c) => Math.max(0, (c ?? 0) - 1));
    try {
      await api.patch(`/api/v1/notifications/${id}/read`);
    } catch {
      // Revert — put the item back as unread at its original position
      if (original) {
        setAllItems((prev) => {
          const exists = prev.some((n) => n.id === id);
          if (exists) return prev;
          return [...prev, { ...original, is_read: false }];
        });
        queryClient.setQueryData(keys.notifCount(), (c) => (c ?? 0) + 1);
      }
    }
  };

  const handleMarkAll = async () => {
    setIsMarkingAll(true);
    setAllItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    queryClient.setQueryData(keys.notifCount(), 0);
    try {
      await api.patch("/api/v1/notifications/read-all");
    } catch {
      // Refetch to recover correct state
      queryClient.invalidateQueries({ queryKey: keys.notifications(page) });
      queryClient.invalidateQueries({ queryKey: keys.notifCount() });
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <>
      {!hideBell && (
        <button ref={buttonRef} type="button" className="notif-bell-btn"
          onClick={toggle}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={open} aria-haspopup="dialog">
          <Bell size={18} strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="notif-bell-badge" aria-hidden="true">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <Panel
          anchorRef={effectiveAnchorRef}
          onClose={handleClose}
          notifications={allItems}
          unreadCount={unreadCount}
          isLoading={isLoading}
          hasMore={page < totalPages}
          onLoadMore={handleLoadMore}
          onMarkOne={handleMarkOne}
          onMarkAll={handleMarkAll}
          isMarkingAll={isMarkingAll}
        />
      )}
    </>
  );
}

export default NotificationPanel;
