import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";

const PAGE_SIZE = 15;
const EMPTY_FORM = { slug: "", name: "", category_slug: "" };

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
      <td><div className="skeleton skeleton-cell" style={{ width: 90 }} /></td>
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
function Domains() {
  const { toasts, toast, dismissToast } = useToast();

  const [all,          setAll]          = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [page,         setPage]         = useState(1);

  // add modal
  const [showAdd,      setShowAdd]      = useState(false);
  const [addForm,      setAddForm]      = useState(EMPTY_FORM);
  const [adding,       setAdding]       = useState(false);
  const [addError,     setAddError]     = useState("");

  // edit modal
  const [editTarget,   setEditTarget]   = useState(null);
  const [editForm,     setEditForm]     = useState({ name: "", category_slug: "" });
  const [updating,     setUpdating]     = useState(false);
  const [editError,    setEditError]    = useState("");

  const [togglingSlug, setTogglingSlug] = useState(null);
  const [deletingSlug, setDeletingSlug] = useState(null);

  /* ── Load ── */
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [domainsRes, catsRes] = await Promise.all([
        api.get("/api/v1/domains",    { params: { active_only: false } }),
        api.get("/api/v1/categories", { params: { active_only: false } }),
      ]);
      setAll(domainsRes.data?.items ?? domainsRes.data);
      setCategories(catsRes.data?.items ?? catsRes.data);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to load data.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
      await api.post("/api/v1/domains", {
        slug:          addForm.slug.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name:          addForm.name.trim(),
        category_slug: addForm.category_slug || null,
        is_active:     true,
        sort_order:    0,
      });
      toast(`Domain "${addForm.name}" created.`);
      setShowAdd(false);
      loadAll();
    } catch (err) {
      setAddError(err.response?.data?.detail || "Failed to create domain.");
    } finally {
      setAdding(false);
    }
  };

  /* ── Edit ── */
  const openEdit = (d) => {
    setEditTarget(d);
    setEditForm({ name: d.name, category_slug: d.category_slug ?? "" });
    setEditError("");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) { setEditError("Name is required."); return; }
    setUpdating(true);
    setEditError("");
    try {
      /* PATCH /domains/{slug} — send only the fields we're editing */
      await api.patch(`/api/v1/domains/${editTarget.slug}`, {
        name:          editForm.name.trim(),
        category_slug: editForm.category_slug || null,
      });
      toast(`Domain "${editForm.name}" updated.`);
      setEditTarget(null);
      loadAll();
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to update domain.");
    } finally {
      setUpdating(false);
    }
  };

  /* ── Toggle active ── */
  const toggleActive = async (domain) => {
    setTogglingSlug(domain.slug);
    try {
      await api.patch(`/api/v1/domains/${domain.slug}`, { is_active: !domain.is_active });
      setAll((prev) =>
        prev.map((d) => d.slug === domain.slug ? { ...d, is_active: !d.is_active } : d)
      );
      toast(`"${domain.name}" ${!domain.is_active ? "activated" : "deactivated"}.`);
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to update status.", "error");
    } finally {
      setTogglingSlug(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (domain) => {
    if (!window.confirm(`Delete "${domain.name}"? This cannot be undone.`)) return;
    setDeletingSlug(domain.slug);
    try {
      await api.delete(`/api/v1/domains/${domain.slug}`, { params: { hard: true } });
      toast(`Domain "${domain.name}" deleted.`);
      loadAll();
    } catch (err) {
      toast(err.response?.data?.detail || "Failed to delete domain.", "error");
    } finally {
      setDeletingSlug(null);
    }
  };

  const catName = (slug) =>
    slug ? (categories.find((c) => c.slug === slug)?.name ?? slug) : "—";

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Domains</h1>
          <p className="admin-subtitle">Manage sub-category domains.</p>
        </div>
        <button className="admin-button" onClick={openAdd}>
          <Plus size={15} /> Add domain
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={8} />
              ) : items.length === 0 ? (
                <tr><td colSpan={4}><p className="admin-empty">No domains yet.</p></td></tr>
              ) : (
                items.map((d) => (
                  <tr key={d.slug} className={d.is_active ? "" : "row-inactive"}>
                    <td style={{ fontWeight: 500, color: "#111827" }}>{d.name}</td>
                    <td style={{ color: "#6b7280", fontSize: 13 }}>{catName(d.category_slug)}</td>
                    <td>
                      <Toggle
                        on={d.is_active}
                        onChange={() => toggleActive(d)}
                        disabled={togglingSlug === d.slug}
                      />
                    </td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          className="admin-icon-btn"
                          title="Edit"
                          onClick={() => openEdit(d)}
                          disabled={deletingSlug === d.slug || togglingSlug === d.slug}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="admin-icon-btn danger"
                          title="Delete"
                          onClick={() => handleDelete(d)}
                          disabled={deletingSlug === d.slug || togglingSlug === d.slug}
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
        <Modal title="Add domain" onClose={() => setShowAdd(false)}>
          <form className="admin-form" onSubmit={handleAdd}>
            <div className="admin-field">
              <label>Name</label>
              <input
                className="admin-input"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Courier Service"
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
                placeholder="e.g. courier"
                required
              />
            </div>
            <div className="admin-field">
              <label>Category <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(optional)</span></label>
              <select
                className="admin-select"
                value={addForm.category_slug}
                onChange={(e) => setAddForm((f) => ({ ...f, category_slug: e.target.value }))}
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            {addError && <div className="admin-error" style={{ fontSize: 13 }}>{addError}</div>}
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
        <Modal title={`Edit domain`} onClose={() => setEditTarget(null)}>
          <form className="admin-form" onSubmit={handleUpdate}>
            <div className="admin-field">
              <label>Name</label>
              <input
                className="admin-input"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="admin-field">
              <label>Category <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>(optional)</span></label>
              <select
                className="admin-select"
                value={editForm.category_slug}
                onChange={(e) => setEditForm((f) => ({ ...f, category_slug: e.target.value }))}
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            {editError && <div className="admin-error" style={{ fontSize: 13 }}>{editError}</div>}
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

export default Domains;
