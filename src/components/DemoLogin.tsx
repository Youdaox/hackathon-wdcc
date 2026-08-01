"use client";

import { useState } from "react";
import { useDemoAuth } from "@/lib/demo-auth";

export function DemoLogin() {
  const { login, register, ready } = useDemoAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await (mode === "login" ? login(username, password) : register(username, password));
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-7 sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/15 text-xl font-bold text-moss">IN</div>
        <div className="mt-6 text-center"><p className="eyebrow">Incline</p><h1 className="mt-2 text-3xl font-extrabold">{mode === "login" ? "Welcome back" : "Create your account"}<span className="text-moss">.</span></h1><p className="mt-2 text-sm text-muted">Your avatar, progress, and check-ins are kept separately for your account.</p></div>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-xs font-semibold text-muted">Username<input required minLength={3} maxLength={30} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink" /></label>
          <label className="block text-xs font-semibold text-muted">Password<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink" /></label>
          {error && <p role="alert" className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          <button disabled={!ready || submitting} className="w-full rounded-xl bg-moss px-4 py-3 text-sm font-bold text-white transition hover:bg-moss-deep disabled:opacity-50">{submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
        </form>
        <button onClick={() => { setMode((value) => value === "login" ? "register" : "login"); setError(null); }} className="mt-5 w-full text-center text-xs font-semibold text-moss hover:underline">{mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}</button>
      </section>
    </main>
  );
}
