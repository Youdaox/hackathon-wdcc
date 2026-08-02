"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { closeActivePipWindow } from "./overlayWindow";

export type DemoUser = { id: string; username: string; name: string; initials: string };

interface DemoAuthValue {
  currentUser: DemoUser | null;
  ready: boolean;
  flashMessage: string | null;
  flashVisible: boolean;
  dismissFlashMessage: () => void;
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
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const flashTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void authRequest("/api/auth/session")
      .then((payload) => { if (active) setCurrentUser(payload.user ?? null); })
      .catch(() => { if (active) setCurrentUser(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; }; 
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const dismissFlashMessage = useCallback(() => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    setFlashVisible(false);
    fadeTimerRef.current = window.setTimeout(() => setFlashMessage(null), 500);
  }, []);

  const authenticate = useCallback(async (path: string, username: string, password: string) => {
    try {
      const payload = await authRequest(path, { username, password });
      const user = payload.user ?? null;
      setCurrentUser(user);
      if (user) {
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
        setFlashMessage(`Welcome, ${user.username}`);
        setFlashVisible(false);
        window.requestAnimationFrame(() => setFlashVisible(true));
        flashTimerRef.current = window.setTimeout(() => {
          setFlashVisible(false);
          fadeTimerRef.current = window.setTimeout(() => setFlashMessage(null), 500);
        }, 6000);
      }
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
    // Bring the desktop pet back in — done here, as a direct side effect of
    // logging out, rather than reactively from DesktopBuddy: the dashboard
    // (and DesktopBuddy along with it) unmounts the instant currentUser goes
    // null, so nothing would survive to observe that transition from inside it.
    closeActivePipWindow();
    window.electronAPI?.closeOverlay();
  }, []);

  const value = useMemo(() => ({ currentUser, ready, flashMessage, flashVisible, dismissFlashMessage, login, register, logout }), [currentUser, ready, flashMessage, flashVisible, dismissFlashMessage, login, register, logout]);
  return <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  const value = useContext(DemoAuthContext);
  if (!value) throw new Error("useDemoAuth must be used inside DemoAuthProvider.");
  return value;
}
