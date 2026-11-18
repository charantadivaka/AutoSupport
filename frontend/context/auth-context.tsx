"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, authApi } from "../lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: "CUSTOMER" | "AGENT" | "ADMIN") => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login({ email, password });
      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", result.accessToken);
      }
      setUser(result.user);
    } catch (err) {
      // Bug #25 fix: Re-throw so page-level catch blocks (login/page.tsx) can show the error
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: "CUSTOMER" | "AGENT" | "ADMIN" = "CUSTOMER",
  ) => {
    setIsLoading(true);
    try {
      const result = await authApi.register({ name, email, password, role });
      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", result.accessToken);
      }
      setUser(result.user);
    } catch (err) {
      // Bug #25 fix: Re-throw so page-level catch blocks (register/page.tsx) can show the error
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout network errors
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
      }
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshProfile,
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
