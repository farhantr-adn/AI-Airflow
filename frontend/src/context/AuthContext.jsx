/** AuthContext - app-wide user state + auth helpers. */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authService } from "@/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await authService.me();
      setUser(u);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: if returning from OAuth callback, AuthCallback handles /me
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const loginWithToken = (token, u) => {
    if (token) localStorage.setItem("forge_token", token);
    setUser(u);
  };

  const logout = async () => {
    try { await authService.logout(); } catch (e) { /* noop */ }
    localStorage.removeItem("forge_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
