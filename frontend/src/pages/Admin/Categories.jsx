import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";

const PAGE_SIZE = 15;
const EMPTY_FORM = { slug: "", name: "" };

/* ── Toggle ──────────────────────────────────────────────────────────────────── */
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

/* ── Skeleton ────────────────────────────────────────────────────────────────── */
function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 140 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 30, borderRadius: 999 }} /></td>
      <td><div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton skeleton-cell" style={{ width: 28, height: 28 }} />
        <div className="skeleton skeleton-cell" style={{ width: 28, height: 28 }} />
      </div></td>
    </tr>
  ));
}

/* ── Pagination ──────────────────────────────────────────────────────────────── */
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
      <span className="admin-pagination-info">{start}–{end} of {total}</span>
      <div className="admin-pagination-btns">
        <button className="admin-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.flatMap((p, i, arr) => {
          const btn = (
            <button key={p} className={`admin-page-btn${p === page ? " active" : ""}`} onClick={() => onPage(p)}>
              {p}
            </button>
          );
          return i > 0 && p - arr[i - 1] > 1
            ? [<span key={`e${p}`} style={{ padding: "0 2px", color: "#9ca3af", fontSize: 13 }}>…</span>, btn]
            : [btn];
        })}
        <button className="admin-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{title}</h2>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
function Categories() {
  const { toasts, toast, dismissToast } = useToast();

  const [all,          setAll]          = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [page,         setPage]         = useState(1);

  // add modal
  const [showAdd,      setShowAdd]      = useState(false);
  const [addForm,      setAddForm]      = useState(EMPTY_FORM);
  const [adding,       setAdding]       = useState(false);
  const [addError,     setAddError]     = useState("");

  // edit modal
  const [editTarget,   setEditTarget]   = useState(null);
  const [editName,     setEditName]     = useState("");
  const [updating,     setUpdating]     = useState(false);
  const [editError,    setEditError]    = useState("");

  // in-flight slugs
  const [togglingSlug, setTogglingSlug] = useState(null);
  const [deletingSlug, setDeletingSlug] = useState(null);

  /* ── Load ── */
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/api/v1/categories", { params: { active_only: false } });
      setAll(data.items ?? data);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to load categories.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const items      = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Add ── */
  const openAdd = () => {
    setAddForm(EMPTY_FORM);
    setAddError("");
    setShowAdd(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setAddError("");
    try {
      await api.post("/api/v1/categories", {
        slug:      addForm.slug.trim().toLowerCase().replace(/\s+/g, "_"),
        name:      addForm.name.trim(),
        is_active: true,
        sort_order: 0,
      });
      toast(`Category "${addForm.name}" created.`);
      setShowAdd(false);
      load();
    } catch (err) {
      setAddError(err.response?.data?.detail || "Failed to create category.");
    } finally {
      setAdding(false);
    }
  };

  /* ── Edit ── */
  const openEdit = (cat) => {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditError("");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editName.trim()) { setEditError("Name is required."); return; }
    setUpdating(true);
    setEditError("");
    try {
      /* PATCH /categories/{slug} — send only fields we want to change */
      await api.patch(`/api/v1/categories/${editTarget.slug}`, {
        name: editName.trim(),
      });
      toast(`Category "${editName}" updated.`);
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to update category.");
    } finally {
      setUpdating(false);
    }
  };

  /* ── Toggle active ── */
  const toggleActive = async (cat) => {
    setTogglingSlug(cat.slug);
    try {
      await api.patch(`/api/v1/categories/${cat.slug}`, { is_active: !cat.is_active });
      setAll((prev) =>
        prev.map((c) => c.slug === cat.slug ? { ...c, is_active: !c.is_active } : c)
      );
      toast(`"${cat.name}" ${!cat.is_active ? "activated" : "deactivated"}.`);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to update status.", "error");
    } finally {
      setTogglingSlug(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    setDeletingSlug(cat.slug);
    try {
      await api.delete(`/api/v1/categories/${cat.slug}`, { params: { hard: true } });
      toast(`Category "${cat.name}" deleted.`);
      load();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to delete category.", "error");
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Categories</h1>
          <p className="admin-subtitle">Manage top-level taxonomy categories.</p>
        </div>
        <button className="admin-button" onClick={openAdd}>
          <Plus size={15} /> Add category
        </button>
      </div>

      {/* Table card */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={8} />
              ) : items.length === 0 ? (
                <tr><td colSpan={3}><p className="admin-empty">No categories yet.</p></td></tr>
              ) : (
                items.map((cat) => (
                  <tr key={cat.slug} className={cat.is_active ? "" : "row-inactive"}>
                    <td style={{ fontWeight: 500, color: "#111827" }}>{cat.name}</td>
                    <td>
                      <Toggle
                        on={cat.is_active}
                        onChange={() => toggleActive(cat)}
                        disabled={togglingSlug === cat.slug}
                      />
                    </td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          className="admin-icon-btn"
                          title="Edit name"
                          onClick={() => openEdit(cat)}
                          disabled={deletingSlug === cat.slug || togglingSlug === cat.slug}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="admin-icon-btn danger"
                          title="Delete"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingSlug === cat.slug || togglingSlug === cat.slug}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={all.length} onPage={setPage} />
      </div>

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add category" onClose={() => setShowAdd(false)}>
          <form className="admin-form" onSubmit={handleAdd}>
            <div className="admin-field">
              <label>Name</label>
              <input
                className="admin-input"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Logistics & Delivery"
                required
                autoFocus
              />
            </div>
            <div className="admin-field">
              <label>Slug <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(lowercase, underscores)</span></label>
              <input
                className="admin-input"
                value={addForm.slug}
                onChange={(e) => setAddForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                placeholder="e.g. logistics"
                required
              />
            </div>
            {addError && (
              <div className="admin-error" style={{ fontSize: 13 }}>{addError}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={adding}>
                {adding ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title={`Edit category`} onClose={() => setEditTarget(null)}>
          <form className="admin-form" onSubmit={handleUpdate}>
            <div className="admin-field">
              <label>Name</label>
              <input
                className="admin-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
              />
            </div>
            {editError && (
              <div className="admin-error" style={{ fontSize: 13 }}>{editError}</div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={updating}>
                {updating ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Categories;
