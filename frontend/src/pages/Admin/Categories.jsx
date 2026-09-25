import { useEffect, useState } from "react";
import api from "../../api/client";

const EMPTY_FORM = {
  slug: "",
  name: "",
  description: "",
  icon: "",
  sort_order: 0,
  is_active: true,
};

function Categories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // create form
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // edit modal
  const [editTarget, setEditTarget] = useState(null); // category being edited
  const [editForm, setEditForm] = useState({ icon: "", sort_order: 0 });
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const loadCategories = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/v1/categories");
      setCategories(data.items ?? data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // --- Create ---
  const handleCreateChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setSuccess("");
    try {
      await api.post("/api/v1/categories", {
        ...createForm,
        sort_order: Number(createForm.sort_order),
      });
      setSuccess(`Category "${createForm.name}" created.`);
      setCreateForm(EMPTY_FORM);
      loadCategories();
    } catch (err) {
      setCreateError(err.response?.data?.detail || "Failed to create category.");
    } finally {
      setCreating(false);
    }
  };

  // --- Edit ---
  const openEdit = (cat) => {
    setEditTarget(cat);
    setEditForm({ icon: cat.icon ?? "", sort_order: cat.sort_order ?? 0 });
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
      await api.patch(`/api/v1/categories/${editTarget.slug}`, {
        icon: editForm.icon,
        sort_order: Number(editForm.sort_order),
      });
      setSuccess(`Category "${editTarget.name}" updated.`);
      setEditTarget(null);
      loadCategories();
    } catch (err) {
      setEditError(err.response?.data?.detail || "Failed to update category.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Categories</h1>

      {success && <p className="admin-success">{success}</p>}
      {error && <p className="admin-error">{error}</p>}

      {/* Create form */}
      <section className="admin-card">
        <h2>Add category</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <div className="admin-form-row">
            <label>
              Slug
              <input
                name="slug"
                value={createForm.slug}
                onChange={handleCreateChange}
                placeholder="e.g. logistics"
                required
              />
            </label>
            <label>
              Name
              <input
                name="name"
                value={createForm.name}
                onChange={handleCreateChange}
                placeholder="e.g. Logistics & Delivery"
                required
              />
            </label>
          </div>

          <label>
            Description
            <input
              name="description"
              value={createForm.description}
              onChange={handleCreateChange}
              placeholder="Short description"
            />
          </label>

          <div className="admin-form-row">
            <label>
              Icon (emoji)
              <input
                name="icon"
                value={createForm.icon}
                onChange={handleCreateChange}
                placeholder="e.g. 🚚"
              />
            </label>
            <label>
              Sort order
              <input
                name="sort_order"
                type="number"
                value={createForm.sort_order}
                onChange={handleCreateChange}
              />
            </label>
            <label className="admin-checkbox-label">
              <input
                name="is_active"
                type="checkbox"
                checked={createForm.is_active}
                onChange={handleCreateChange}
              />
              Active
            </label>
          </div>

          {createError && <p className="admin-error">{createError}</p>}

          <button type="submit" className="admin-button" disabled={creating}>
            {creating ? "Creating…" : "Create category"}
          </button>
        </form>
      </section>

      {/* Table */}
      <section className="admin-card">
        <h2>All categories</h2>

        {isLoading && <p>Loading…</p>}

        {!isLoading && categories.length === 0 && (
          <p className="admin-empty">No categories yet.</p>
        )}

        {!isLoading && categories.length > 0 && (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Icon</th>
                  <th>Slug</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Sort</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.slug}>
                    <td>{cat.icon}</td>
                    <td><code>{cat.slug}</code></td>
                    <td>{cat.name}</td>
                    <td>{cat.description}</td>
                    <td>{cat.sort_order}</td>
                    <td>{cat.is_active ? "✓" : "—"}</td>
                    <td>
                      <button
                        className="admin-button-sm"
                        onClick={() => openEdit(cat)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editTarget && (
        <div className="admin-modal-backdrop" onClick={() => setEditTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit "{editTarget.name}"</h2>
            <form className="admin-form" onSubmit={handleUpdate}>
              <label>
                Icon (emoji)
                <input
                  name="icon"
                  value={editForm.icon}
                  onChange={handleEditChange}
                  placeholder="e.g. 💻"
                />
              </label>
              <label>
                Sort order
                <input
                  name="sort_order"
                  type="number"
                  value={editForm.sort_order}
                  onChange={handleEditChange}
                />
              </label>

              {editError && <p className="admin-error">{editError}</p>}

              <div className="admin-form-row">
                <button type="submit" className="admin-button" disabled={updating}>
                  {updating ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="admin-button-outline"
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categories;
