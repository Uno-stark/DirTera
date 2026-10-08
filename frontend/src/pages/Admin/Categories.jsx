
import { useEffect, useState } from "react";
import { Check, Minus, Trash2 } from "lucide-react";
import api from "../../api/client";

const CONFIRM_DELETE = (name) =>
  window.confirm(`Deactivate "${name}"? It will be hidden from public listings.`);

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

  // Create form
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    icon: "",
    sort_order: 0,
  });
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete
  const [deletingSlug, setDeletingSlug] = useState(null);

  const loadCategories = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data } = await api.get("/api/v1/categories", {
        params: { active_only: false },
      });

      setCategories(data.items ?? data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to load categories."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // --------------------------------------------------
  // Create
  // --------------------------------------------------

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
      setShowCreateForm(false);

      await loadCategories();
    } catch (err) {
      setCreateError(
        err.response?.data?.detail || "Failed to create category."
      );
    } finally {
      setCreating(false);
    }
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setCreateForm(EMPTY_FORM);
    setCreateError("");
  };

  // --------------------------------------------------
  // Edit
  // --------------------------------------------------

  const openEdit = (cat) => {
    setEditTarget(cat);

    setEditForm({
      icon: cat.icon ?? "",
      sort_order: cat.sort_order ?? 0,
    });

    setEditError("");
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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

      await loadCategories();
    } catch (err) {
      setEditError(
        err.response?.data?.detail || "Failed to update category."
      );
    } finally {
      setUpdating(false);
    }
  };

  // --------------------------------------------------
  // Delete
  // --------------------------------------------------

  const handleDelete = async (category) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingSlug(category.slug);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/api/v1/categories/${category.slug}`);

      setSuccess(`Category "${category.name}" deleted.`);

      await loadCategories();
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to delete category."
      );
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Categories</h1>

      {success && <p className="admin-success">{success}</p>}
      {error && <p className="admin-error">{error}</p>}

      {/* Add Category */}
      <section className="admin-card">
        {!showCreateForm ? (
          <button
            type="button"
            className="admin-button"
            onClick={() => {
              setShowCreateForm(true);
              setCreateError("");
              setSuccess("");
            }}
          >
            + Add Category
          </button>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2>Add category</h2>

              <button
                type="button"
                className="admin-button-outline"
                onClick={cancelCreate}
              >
                Cancel
              </button>
            </div>

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
                  Icon
                  <input
                    name="icon"
                    value={createForm.icon}
                    onChange={handleCreateChange}
                    placeholder="e.g. truck"
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

              {createError && (
                <p className="admin-error">{createError}</p>
              )}

              <div className="admin-form-row">
                <button
                  type="submit"
                  className="admin-button"
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create category"}
                </button>

              </div>
            </form>
          </>
        )}
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
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.slug}>
                    <td>{cat.icon}</td>

                    <td>
                      <code>{cat.slug}</code>
                    </td>

                    <td>{cat.name}</td>

                    <td>{cat.description}</td>

                    <td>{cat.sort_order}</td>

                    <td>
                      {cat.is_active ? (
                        <Check size={14} />
                      ) : (
                        <Minus
                          size={14}
                          color="#9ca3af"
                        />
                      )}
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          className="admin-button-sm"
                          onClick={() => openEdit(cat)}
                          disabled={deletingSlug === cat.slug}
                        >
                          Edit
                        </button>

                        <button
                          className="admin-button-sm"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingSlug === cat.slug}
                          title="Delete category"
                          style={{
                            background: "#fee2e2",
                            color: "#dc2626",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: deletingSlug === cat.slug ? 0.5 : 1,
                            transition: "background 0.15s",
                          }}
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

      {/* Edit modal */}
      {editTarget && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Edit "{editTarget.name}"</h2>

            <form className="admin-form" onSubmit={handleUpdate}>
              <label>
                Icon
                <input
                  name="icon"
                  value={editForm.icon}
                  onChange={handleEditChange}
                  placeholder="e.g. laptop"
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

              {editError && (
                <p className="admin-error">{editError}</p>
              )}

              <div className="admin-form-row">
                <button
                  type="submit"
                  className="admin-button"
                  disabled={updating}
                >
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
