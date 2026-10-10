import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Star } from "lucide-react";
import api from "../../api/client";
import { Toast, useToast } from "../../components/admin/Toast";
import { parseErrorMessage } from "../../utils/errorParser";

const PAGE_SIZE = 15;
const EMPTY_FORM = {
  slug: "",
  label: "",
  amount: "",
  currency: "ETB",
  duration_days: 30,
  description: "",
  is_premiered: false,
  is_active: true,
};

/* ── Query key factory ───────────────────────────────────────────────────── */
const planKeys = {
  all: () => ["admin", "plans", "all"],
};

/* ── Data fetcher ─────────────────────────────────────────────────────────── */
async function fetchAllPlans() {
  const { data } = await api.get("/api/v1/payments/plans/all");
  return Array.isArray(data) ? data : data.items ?? [];
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
function SkeletonRows({ count = 8 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton skeleton-cell" style={{ width: 120 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 80 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 60 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 40 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 30, borderRadius: 999 }} /></td>
      <td><div className="skeleton skeleton-cell" style={{ width: 30, borderRadius: 999 }} /></td>
      <td><div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton skeleton-cell" style={{ width: 28, height: 28 }} />
        <div className="skeleton skeleton-cell" style={{ width: 28, height: 28 }} />
      </div></td>
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

/* ── Modal ───────────────────────────────────────────────────────────────── */
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

/* ── Main ────────────────────────────────────────────────────────────────── */
function Plans() {
  const { toasts, toast, dismissToast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);

  // add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* ── Load ── */
  const { data: allPlans = [], isLoading, isError } = useQuery({
    queryKey: planKeys.all(),
    queryFn: fetchAllPlans,
    staleTime: 60_000,
    retry: 1,
  });

  const totalPages = Math.max(1, Math.ceil(allPlans.length / PAGE_SIZE));
  const items = allPlans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const refetch = () => queryClient.invalidateQueries({ queryKey: planKeys.all() });

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
      await api.post("/api/v1/payments/plans", {
        slug: addForm.slug.trim().toLowerCase().replace(/\s+/g, "_"),
        label: addForm.label.trim(),
        amount: parseFloat(addForm.amount),
        currency: addForm.currency,
        duration_days: parseInt(addForm.duration_days, 10),
        description: addForm.description.trim() || null,
        is_premiered: addForm.is_premiered,
        is_active: addForm.is_active,
      });
      toast(`Plan "${addForm.label}" created.`);
      setShowAdd(false);
      refetch();
    } catch (err) {
      setAddError(parseErrorMessage(err, "Failed to create plan."));
    } finally {
      setAdding(false);
    }
  };

  /* ── Edit ── */
  const openEdit = (plan) => {
    setEditTarget(plan);
    setEditForm({
      slug: plan.slug,
      label: plan.label,
      amount: plan.amount.toString(),
      currency: plan.currency,
      duration_days: plan.duration_days,
      description: plan.description || "",
      is_premiered: plan.is_premiered,
      is_active: plan.is_active,
    });
    setEditError("");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.label.trim()) {
      setEditError("Label is required.");
      return;
    }
    setUpdating(true);
    setEditError("");
    try {
      await api.patch(`/api/v1/payments/plans/${editTarget.id}`, {
        label: editForm.label.trim(),
        amount: parseFloat(editForm.amount),
        currency: editForm.currency,
        duration_days: parseInt(editForm.duration_days, 10),
        description: editForm.description.trim() || null,
        is_premiered: editForm.is_premiered,
        is_active: editForm.is_active,
      });
      toast(`Plan "${editForm.label}" updated.`);
      setEditTarget(null);
      refetch();
    } catch (err) {
      setEditError(parseErrorMessage(err, "Failed to update plan."));
    } finally {
      setUpdating(false);
    }
  };

  /* ── Toggle active ── */
  const toggleActive = async (plan) => {
    setTogglingId(plan.id);
    try {
      await api.patch(`/api/v1/payments/plans/${plan.id}`, {
        is_active: !plan.is_active,
      });
      toast(`"${plan.label}" ${!plan.is_active ? "activated" : "deactivated"}.`);
      refetch();
    } catch (err) {
      toast(parseErrorMessage(err, "Failed to update status."), "error");
    } finally {
      setTogglingId(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (plan) => {
    if (!window.confirm(`Delete "${plan.label}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    try {
      await api.delete(`/api/v1/payments/plans/${plan.id}`, {
        params: { hard: true },
      });
      toast(`Plan "${plan.label}" deleted.`);
      refetch();
    } catch (err) {
      toast(parseErrorMessage(err, "Failed to delete plan."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-page">
      <Toast messages={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Subscription Plans</h1>
          <p className="admin-subtitle">Manage subscription pricing and features.</p>
        </div>
        <button className="admin-button" onClick={openAdd}>
          <Plus size={15} /> Add plan
        </button>
      </div>

      {isError && (
        <div className="admin-error" style={{ marginBottom: 14 }}>
          Failed to load plans.
        </div>
      )}

      {/* Table card */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Amount</th>
                <th>Duration</th>
                <th>Slug</th>
                <th>Premiered</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows count={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <p className="admin-empty">No plans yet.</p>
                  </td>
                </tr>
              ) : (
                items.map((plan) => (
                  <tr key={plan.id} className={plan.is_active ? "" : "row-inactive"}>
                    <td style={{ fontWeight: 500, color: "#111827" }}>
                      {plan.label}
                      {plan.is_premiered && (
                        <Star
                          size={12}
                          fill="#f59e0b"
                          stroke="#f59e0b"
                          style={{ marginLeft: 6, verticalAlign: "middle" }}
                        />
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>
                      {Number(plan.amount).toLocaleString()} {plan.currency}
                    </td>
                    <td>{plan.duration_days} days</td>
                    <td style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
                      {plan.slug}
                    </td>
                    <td>
                      {plan.is_premiered ? (
                        <span style={{ color: "#f59e0b" }}>✓</span>
                      ) : (
                        <span style={{ color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                    <td>
                      <Toggle
                        on={plan.is_active}
                        onChange={() => toggleActive(plan)}
                        disabled={togglingId === plan.id}
                      />
                    </td>
                    <td>
                      <div className="admin-action-row">
                        <button
                          className="admin-icon-btn"
                          title="Edit"
                          onClick={() => openEdit(plan)}
                          disabled={deletingId === plan.id || togglingId === plan.id}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="admin-icon-btn danger"
                          title="Delete"
                          onClick={() => handleDelete(plan)}
                          disabled={deletingId === plan.id || togglingId === plan.id}
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

        <Pagination page={page} totalPages={totalPages} total={allPlans.length} onPage={setPage} />
      </div>

      {/* ── Add modal ── */}
      {showAdd && (
        <Modal title="Add subscription plan" onClose={() => setShowAdd(false)}>
          <form className="admin-form" onSubmit={handleAdd}>
            <div className="admin-field">
              <label>Label (Display name)</label>
              <input
                className="admin-input"
                value={addForm.label}
                onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Basic Plan"
                required
                autoFocus
              />
            </div>
            <div className="admin-field">
              <label>
                Slug{" "}
                <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>
                  (lowercase, underscores)
                </span>
              </label>
              <input
                className="admin-input"
                value={addForm.slug}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                  }))
                }
                placeholder="e.g. basic"
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="admin-field">
                <label>Amount</label>
                <input
                  className="admin-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="admin-field">
                <label>Currency</label>
                <select
                  className="admin-select"
                  value={addForm.currency}
                  onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="ETB">ETB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="admin-field">
              <label>Duration (days)</label>
              <input
                className="admin-input"
                type="number"
                min="1"
                value={addForm.duration_days}
                onChange={(e) => setAddForm((f) => ({ ...f, duration_days: e.target.value }))}
                required
              />
            </div>
            <div className="admin-field">
              <label>
                Description{" "}
                <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>
                  (comma-separated features)
                </span>
              </label>
              <textarea
                className="admin-textarea"
                rows={3}
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Feature 1, Feature 2, Feature 3"
              />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addForm.is_premiered}
                  onChange={(e) => setAddForm((f) => ({ ...f, is_premiered: e.target.checked }))}
                />
                <span style={{ fontSize: 13.5 }}>Premiered</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={addForm.is_active}
                  onChange={(e) => setAddForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span style={{ fontSize: 13.5 }}>Active</span>
              </label>
            </div>
            {addError && <div className="admin-error" style={{ fontSize: 13 }}>{addError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={adding}>
                {adding ? "Creating…" : "Create plan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editTarget && (
        <Modal title={`Edit plan`} onClose={() => setEditTarget(null)}>
          <form className="admin-form" onSubmit={handleUpdate}>
            <div className="admin-field">
              <label>Label (Display name)</label>
              <input
                className="admin-input"
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="admin-field">
                <label>Amount</label>
                <input
                  className="admin-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-field">
                <label>Currency</label>
                <select
                  className="admin-select"
                  value={editForm.currency}
                  onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="ETB">ETB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="admin-field">
              <label>Duration (days)</label>
              <input
                className="admin-input"
                type="number"
                min="1"
                value={editForm.duration_days}
                onChange={(e) => setEditForm((f) => ({ ...f, duration_days: e.target.value }))}
                required
              />
            </div>
            <div className="admin-field">
              <label>
                Description{" "}
                <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 12 }}>
                  (comma-separated features)
                </span>
              </label>
              <textarea
                className="admin-textarea"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editForm.is_premiered}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_premiered: e.target.checked }))}
                />
                <span style={{ fontSize: 13.5 }}>Premiered</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span style={{ fontSize: 13.5 }}>Active</span>
              </label>
            </div>
            {editError && <div className="admin-error" style={{ fontSize: 13 }}>{editError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="admin-button-outline" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button type="submit" className="admin-button" disabled={updating}>
                {updating ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Plans;
