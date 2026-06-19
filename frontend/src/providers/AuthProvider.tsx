"use client";

import * as React from "react";

import {
  clearAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from "@/lib/auth";
import type { AuthUser } from "@/types/auth.types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Hydrate from localStorage on mount. Token validity is enforced server-side;
  // a 401 from the API interceptor will clear the session.
  React.useEffect(() => {
    if (getToken()) {
      setUser(getStoredUser());
    }
    setIsLoading(false);
  }, []);

  const setSession = React.useCallback((token: string, nextUser: AuthUser) => {
    setToken(token);
    setStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const updateUser = React.useCallback((nextUser: AuthUser) => {
    setStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  const logout = React.useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      setSession,
      updateUser,
      logout,
    }),
    [user, isLoading, setSession, updateUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
