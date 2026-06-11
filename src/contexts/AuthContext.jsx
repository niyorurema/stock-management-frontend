// src/contexts/AuthContext.jsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { API_BASE } from "../config/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);

  const authHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    "X-Auth-Token": token,
    "Content-Type": "application/json",
  });

  const checkApiOnline = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/test`, { cache: "no-store" });
      const ok = r.ok;
      setApiOnline(ok);
      return ok;
    } catch {
      setApiOnline(false);
      return false;
    }
  }, []);

  const refreshUserFromServer = useCallback(async (token) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders(token),
      });

      // Gérer les erreurs d'authentification
      if (response.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        setUser(null);
        return false;
      }

      const data = await response.json();
      if (data.success && data.data) {
        localStorage.setItem("user", JSON.stringify(data.data));
        setUser(data.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erreur lors du rafraîchissement de l'utilisateur:", error);
      return false;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    await checkApiOnline();

    const token = localStorage.getItem("auth_token");
    const savedUser = localStorage.getItem("user");

    if (!token) {
      setLoading(false);
      return;
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    try {
      await refreshUserFromServer(token);
    } catch {
      // Garder le user local si le réseau échoue temporairement
    }

    setLoading(false);
  }, [checkApiOnline, refreshUserFromServer]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const online = await checkApiOnline();
    if (!online) {
      return {
        success: false,
        message:
          "Serveur API inaccessible. Ouvrez un terminal : cd backend puis php spark serve",
      };
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (data.success) {
        localStorage.setItem("auth_token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch {
      return {
        success: false,
        message: "Erreur de connexion au serveur",
      };
    }
  };

  const logout = () => {
    // Nettoyage complet du localStorage
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("session_info");
    localStorage.removeItem("last_activity");

    // Réinitialiser l'état
    setUser(null);

    // Rediriger vers la page de connexion
    window.location.href = "/login";
  };

  const updateUser = (userData) => {
    const merged = { ...user, ...userData };
    localStorage.setItem("user", JSON.stringify(merged));
    setUser(merged);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    try {
      await refreshUserFromServer(token);
    } catch {
      /* ignore */
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const roles = user.roles || [];
    const permissions = user.permissions || [];
    if (roles.includes("super_admin") || permissions.includes("*")) return true;
    if (permissions.includes(permission)) return true;
    const [module] = (permission || "").split(".");
    return permissions.includes(`${module}.*`);
  };

  const hasAnyPermission = (list) => list.some((p) => hasPermission(p));

  const handleTokenExpired = () => {
    // Appelé automatiquement par l'intercepteur apiService
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    localStorage.removeItem("session_info");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        apiOnline,
        login,
        logout,
        updateUser,
        refreshUser,
        handleTokenExpired,
        checkApiOnline,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
