"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DemoUser = { id: string; username: string; name: string; initials: string };

interface DemoAuthValue {
  currentUser: DemoUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthValue | null>(null);

async function authRequest(path: string, body?: Record<string, string>) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({})) as { user?: DemoUser | null; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to complete that request.");
  return payload;
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void authRequest("/api/auth/session")
      .then((payload) => { if (active) setCurrentUser(payload.user ?? null); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const authenticate = useCallback(async (path: string, username: string, password: string) => {
    try {
      const payload = await authRequest(path, { username, password });
      setCurrentUser(payload.user ?? null);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to sign in.";
    }
  }, []);

  const login = useCallback((username: string, password: string) => authenticate("/api/auth/login", username, password), [authenticate]);
  const register = useCallback((username: string, password: string) => authenticate("/api/auth/register", username, password), [authenticate]);
  const logout = useCallback(async () => {
    await authRequest("/api/auth/logout", {});
    setCurrentUser(null);
  }, []);

  const value = useMemo(() => ({ currentUser, ready, login, register, logout }), [currentUser, ready, login, register, logout]);
  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  const value = useContext(DemoAuthContext);
  if (!value) throw new Error("useDemoAuth must be used inside DemoAuthProvider.");
  return value;
}
