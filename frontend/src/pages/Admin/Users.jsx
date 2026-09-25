import { useEffect, useRef, useState } from "react";
import api from "../../api/client";

function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const debounceRef = useRef(null);

  const loadUsers = async (query = "") => {
    setIsLoading(true);
    setError("");
    try {
      const params = query ? { search: query } : {};
      const { data } = await api.get("/api/v1/users", { params });
      setUsers(data.items ?? data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadUsers(value), 350);
  };

  const toggleAdmin = async (user) => {
    setTogglingId(user.id);
    try {
      const { data } = await api.patch(`/api/v1/users/${user.id}/admin`, {
        is_admin: !user.is_admin,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_admin: data.is_admin } : u)));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update user.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Users</h1>

      <div className="admin-card">
        <input
          className="admin-search"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={handleSearch}
        />

        {error && <p className="admin-error" style={{ marginTop: 16 }}>{error}</p>}

        {isLoading && <p style={{ marginTop: 16, color: "#6b7280" }}>Loading…</p>}

        {!isLoading && !error && users.length === 0 && (
          <p className="admin-empty" style={{ marginTop: 16 }}>No users found.</p>
        )}

        {!isLoading && users.length > 0 && (
          <div className="admin-table-wrapper" style={{ marginTop: 20 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Active</th>
                  <th>Verified</th>
                  <th>Admin</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                    <td>{u.email}</td>
                    <td>{u.is_active ? "✓" : "—"}</td>
                    <td>{u.is_verified ? "✓" : "—"}</td>
                    <td>
                      <span className={`admin-badge ${u.is_admin ? "admin-badge-admin" : "admin-badge-user"}`}>
                        {u.is_admin ? "Admin" : "User"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className={u.is_admin ? "admin-button-outline" : "admin-button-sm"}
                        disabled={togglingId === u.id}
                        onClick={() => toggleAdmin(u)}
                      >
                        {togglingId === u.id
                          ? "…"
                          : u.is_admin
                          ? "Remove admin"
                          : "Make admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Users;
