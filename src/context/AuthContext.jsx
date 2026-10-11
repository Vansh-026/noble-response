import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState("login"); // 'login' | 'register' | 'forgot'

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const currentUser = await authApi.getMe();
        if (mounted) setUser(currentUser);
      } catch (err) {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async ({ email, password }) => {
    const data = await authApi.login({ email, password });
    setUser(data.user);
    setAuthModalOpen(false);
    return data;
  };

  const register = async ({ name, email, password }) => {
    const data = await authApi.register({ name, email, password });
    setUser(data.user);
    setAuthModalOpen(false);
    return data;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const openAuthModal = (mode = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        authModalOpen,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
