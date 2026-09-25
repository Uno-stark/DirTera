import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Account() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>My Account</h1>

      <p>
        Welcome, {user.full_name || user.email}.
      </p>

      <p>Email: {user.email}</p>

      <button type="button" onClick={logout}>
        Sign out
      </button>

      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}

export default Account;