"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type DemoUser = { id: string; name: string; initials: string };

export const DEMO_USERS: DemoUser[] = [
  { id: "user-1", name: "Alice", initials: "AL" },
  { id: "user-2", name: "Bob", initials: "BO" },
  { id: "user-3", name: "Charlie", initials: "CH" },
  { id: "user-4", name: "Diana", initials: "DI" },
  { id: "user-5", name: "Ethan", initials: "ET" },
];

const STORAGE_KEY = "incline.demo-user.v1";
const CHANGE_EVENT = "incline-demo-auth-change";

interface DemoAuthValue {
  currentUser: DemoUser | null;
  login: (userId: string) => void;
  logout: () => void;
}

const DemoAuthContext = createContext<DemoAuthValue | null>(null);

function getSnapshot() {
  try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const userId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const currentUser = DEMO_USERS.find((user) => user.id === userId) ?? null;

  function login(nextUserId: string) {
    if (!DEMO_USERS.some((user) => user.id === nextUserId)) return;
    window.sessionStorage.setItem(STORAGE_KEY, nextUserId);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function logout() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return <DemoAuthContext.Provider value={{ currentUser, login, logout }}>{children}</DemoAuthContext.Provider>;
}

export function useDemoAuth() {
  const value = useContext(DemoAuthContext);
  if (!value) throw new Error("useDemoAuth must be used inside DemoAuthProvider.");
  return value;
}
