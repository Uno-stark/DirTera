import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [isLoading,  setIsLoading]  = useState(true);
  // "idle" | "pending" | "done" | "error"
  const [logoutState, setLogoutState] = useState("idle");

  useEffect(() => {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) { setIsLoading(false); return; }

    const loadUser = async () => {
      try {
        const { data } = await api.get("/api/v1/auth/me");
        setUser(data);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

 
  const logout = useCallback(async () => {
    setLogoutState("pending");
    try {
      await api.post("/api/v1/auth/logout");
      setLogoutState("done");
    } catch {
      // Server-side revocation failed (network down, token already expired, …)
      // Local logout still proceeds — token will expire on its own.
      setLogoutState("error");
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    }
  }, []);

  const clearLogoutState = useCallback(() => setLogoutState("idle"), []);

  const value = {
    user,
    setUser,
    isLoading,
    isAuthenticated: Boolean(user),
    logout,
    logoutState,
    clearLogoutState,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
