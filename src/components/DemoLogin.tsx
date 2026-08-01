"use client";

import { useState } from "react";
import { DEMO_USERS, useDemoAuth } from "@/lib/demo-auth";

export function DemoLogin() {
  const { login } = useDemoAuth();
  const [selectedUserId, setSelectedUserId] = useState(DEMO_USERS[0].id);
  const selectedUser = DEMO_USERS.find((user) => user.id === selectedUserId) ?? DEMO_USERS[0];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-7 sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/15 text-xl font-bold text-moss">{selectedUser.initials}</div>
        <div className="mt-6 text-center"><p className="eyebrow">Incline demo</p><h1 className="mt-2 text-3xl font-extrabold">Welcome back<span className="text-moss">.</span></h1><p className="mt-2 text-sm text-muted">Choose a profile to access focus tasks, encouragements, and leaderboards.</p></div>
        <label htmlFor="global-login-user" className="mt-7 block text-xs font-semibold text-muted">Demo profile</label>
        <select id="global-login-user" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 font-semibold text-ink">
          {DEMO_USERS.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <button onClick={() => login(selectedUser.id)} className="mt-4 w-full rounded-xl bg-moss px-4 py-3 text-sm font-bold text-white transition hover:bg-moss-deep">Log in as {selectedUser.name}</button>
        <p className="mt-4 text-center text-xs text-faint">Demo access only — no password required.</p>
      </section>
    </main>
  );
}
