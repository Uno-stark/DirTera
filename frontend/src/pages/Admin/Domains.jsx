import { useEffect, useState } from "react";
import { Check, Minus, Trash2 } from "lucide-react";
import api from "../../api/client";

const EMPTY_FORM = {
  slug: "",
  name: "",
  description: "",
  icon: "",
  sort_order: 0,
  is_active: true,
  category_slug: "",
};

function Domains() {
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ icon: "", sort_order: 0, category_slug: "" });
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadDomains = async () => {
    try {
      const { data } = await api.get("/api/v1/domains", { params: { active_only: false } });
      setDomains(Array.isArray(data) ? data : data.items ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load domains.");
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [domainsRes, catsRes] = await Promise.all([
          api.get("/api/v1/domains", { params: { active_only: false } }),
          api.get("/api/v1/categories", { params: { active_only: false } }),
        ]);
        setDomains(Array.isArray(domainsRes.data) ? domainsRes.data : domainsRes.data.items ?? []);
        setCategories(Array.isArray(catsRes.data) ? catsRes.data : catsRes.data.items ?? []);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleCreateChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setSuccess("");
    try {
      await api.post("/api/v1/domains", {
        ...createForm,
        sort_order: Number(createForm.sort_order),
        category_slug: createForm.category_slug || null,
      });
      setSuccess(`Domain "${createForm.name}" created.`);
      setCreateForm(EMPTY_FORM);
      setShowCreateForm(false);
      await loadDomains();
    } catch (err) {
      setCreateError(err.response?.data?.detail || "Failed to create domain.");
    } finally {
      setCreating(false);
    }
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setCreateForm(EMPTY_FORM);
    setCreateError("");
  };

  const openEdit = (domain) => {
    setEditTarget(domain);
    setEditForm({ icon: domain.icon ?? "", sort_order: domain.sort_order ?? 0, category_slug: domain.category_slug ?? "" });
    setEditError("");
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setEditError("");
    setSuccess("");
    try {
      await api.patch(`/api/v1/domains/${editTarget.slug}`, {
        icon: editForm.icon || null,
        sort_order: Number(editForm.sort_order),
        category_slug: editForm.category_slug || null,
      });
      setSuccess(`Domain "${editTarget.name}" updated.`);
      setEditTarget(null);
      await loadDomains();
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to update domain.");
    } finally {
      setUpdating(false);
    }
  };

  const openDelete = (domain) => {
    setDeleteTarget(domain);
    setHardDelete(false);
    setDeleteError("");
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError("");
    setSuccess("");
    try {
      await api.delete(`/api/v1/domains/${deleteTarget.slug}`, { params: { hard: hardDelete } });
      setSuccess(hardDelete ? `Domain "${deleteTarget.name}" permanently deleted.` : `Domain "${deleteTarget.name}" deactivated.`);
      setDeleteTarget(null);
      await loadDomains();
    } catch (err) {
      setDeleteError(err.response?.data?.detail || "Failed to delete domain.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Domains</h1>

      {success && <p className="admin-success">{success}</p>}
      {error && <p className="admin-error">{error}</p>}

      <section className="admin-card">
        {!showCreateForm ? (
          <button type="button" className="admin-button" onClick={() => { setShowCreateForm(true); setCreateError(""); setSuccess(""); }}>
            + Add Domain
          </button>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Add Domain</h2>
              <button type="button" className="admin-button-outline" onClick={cancelCreate}>Cancel</button>
            </div>
            <form className="admin-form" onSubmit={handleCreate}>
              <div className="admin-form-row">
                <label>Slug<input name="slug" value={createForm.slug} onChange={handleCreateChange} placeholder="e.g. courier" required /></label>
                <label>Name<input name="name" value={createForm.name} onChange={handleCreateChange} placeholder="e.g. Courier Service" required /></label>
              </div>
              <label>Description<input name="description" value={createForm.description} onChange={handleCreateChange} placeholder="Short description" /></label>
              <div className="admin-form-row">
                <label>Icon<input name="icon" value={createForm.icon} onChange={handleCreateChange} placeholder="e.g. box" /></label>
                <label>Sort order<input name="sort_order" type="number" value={createForm.sort_order} onChange={handleCreateChange} /></label>
                <label>Category
                  <select name="category_slug" className="admin-select" value={createForm.category_slug} onChange={handleCreateChange}>
                    <option value="">— none —</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </label>
                <label className="admin-checkbox-label">
                  <input name="is_active" type="checkbox" checked={createForm.is_active} onChange={handleCreateChange} />
                  Active
                </label>
              </div>
              {createError && <p className="admin-error">{createError}</p>}
              <button type="submit" className="admin-button" disabled={creating}>{creating ? "Creating…" : "Create Domain"}</button>
            </form>
          </>
        )}
      </section>

      <section className="admin-card">
        <h2>All Domains</h2>
        {isLoading && <p>Loading…</p>}
        {!isLoading && domains.length === 0 && <p className="admin-empty">No domains yet.</p>}
        {!isLoading && domains.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr><th>Icon</th><th>Slug</th><th>Name</th><th>Category</th><th>Sort</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.slug}>
                    <td>{d.icon}</td>
                    <td><code>{d.slug}</code></td>
                    <td>{d.name}</td>
                    <td>{d.category_slug ?? "—"}</td>
                    <td>{d.sort_order}</td>
                    <td>{d.is_active ? <Check size={14} /> : <Minus size={14} color="#9ca3af" />}</td>
                    <td>
                      <div className="admin-action-row">
                        <button className="admin-button-sm" onClick={() => openEdit(d)}>Edit</button>
                        <button
                          onClick={() => openDelete(d)}
                          title="Delete domain"
                          style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fca5a5"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fee2e2"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editTarget && (
        <div className="admin-modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit "{editTarget.name}"</h2>
            <form className="admin-form" onSubmit={handleUpdate}>
              <label>Icon<input name="icon" value={editForm.icon} onChange={handleEditChange} placeholder="e.g. box" /></label>
              <label>Sort order<input name="sort_order" type="number" value={editForm.sort_order} onChange={handleEditChange} /></label>
              <label>Category
                <select name="category_slug" className="admin-select" value={editForm.category_slug} onChange={handleEditChange}>
                  <option value="">— none —</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </label>
              {editError && <p className="admin-error">{editError}</p>}
              <div className="admin-form-row">
                <button type="submit" className="admin-button" disabled={updating}>{updating ? "Saving…" : "Save changes"}</button>
                <button type="button" className="admin-button-outline" onClick={() => setEditTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete "{deleteTarget.name}"</h2>
            <form className="admin-form" onSubmit={confirmDelete}>
              <p style={{ margin: "0 0 16px", color: "#374151" }}>
                {hardDelete ? "This will permanently remove the domain from the database." : "This will deactivate the domain. Existing websites keep their reference."}
              </p>
              <label className="admin-checkbox-label">
                <input type="checkbox" checked={hardDelete} onChange={(e) => setHardDelete(e.target.checked)} />
                Hard delete (permanent)
              </label>
              {deleteError && <p className="admin-error">{deleteError}</p>}
              <div className="admin-form-row">
                <button type="submit" className="admin-button admin-button-red-solid" disabled={deleting}>{deleting ? "Deleting…" : hardDelete ? "Delete permanently" : "Deactivate"}</button>
                <button type="button" className="admin-button-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Domains;
