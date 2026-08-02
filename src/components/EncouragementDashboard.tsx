"use client";

import { useCallback, useEffect, useState } from "react";
import type { EncouragementBalance, EncouragementHistoryRecord, LeaderboardEntry } from "@/lib/leaderboard/types";
import { useDemoAuth, type DemoUser } from "@/lib/demo-auth";
import { DemoLogin } from "@/components/DemoLogin";
import { XpReward } from "@/components/XpReward";
import { formatCompact } from "@/lib/time";

type Period = "week" | "month";
type Notice = { kind: "success" | "error"; message: string } | null;
type CommunityUser = DemoUser;
type FocusLeaderboardEntry = { rank: number; userId: string; displayName: string; focusedMs: number; unfocusedMs: number };
const WELLBEING_TASKS = ["Take three deep breaths", "Look into the distance", "Stand up and stretch", "Drink some water"] as const;

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function uniqueLeaderboardEntries(entries: LeaderboardEntry[]) {
  return [...new Map(entries.map((entry) => [entry.userId, entry])).values()];
}

async function request<T>(url: string, init?: RequestInit, user?: DemoUser | null): Promise<T> {
  const headers = new Headers(init?.headers);
  if (user) {
    headers.set("x-user-id", user.id);
    headers.set("x-user-name", user.name);
  }
  const response = await fetch(url, { credentials: "same-origin", ...init, headers });
  const body = await response.json().catch(() => ({})) as T & { error?: string | { message?: string } };
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Something went wrong. Please try again.");
  return body;
}

export function EncouragementDashboard() {
  const { currentUser, logout } = useDemoAuth();
  const [balance, setBalance] = useState<EncouragementBalance | null>(null);
  const [received, setReceived] = useState<EncouragementHistoryRecord[]>([]);
  const [boards, setBoards] = useState<Record<Period, LeaderboardEntry[]>>({ week: [], month: [] });
  const [focusBoard, setFocusBoard] = useState<FocusLeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<CommunityUser[]>([]);
  const [results, setResults] = useState<CommunityUser[]>([]);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>("initial");
  const [activeTask, setActiveTask] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextBalance, weekly, monthly, friendResponse, receivedResponse, focusResponse] = await Promise.all([
      request<EncouragementBalance>("/api/encouragements/balance", undefined, currentUser), request<{ entries: LeaderboardEntry[] }>("/api/leaderboards?period=week", undefined, currentUser), request<{ entries: LeaderboardEntry[] }>("/api/leaderboards?period=month", undefined, currentUser), request<{ friends: CommunityUser[] }>("/api/friends", undefined, currentUser), request<{ encouragements: EncouragementHistoryRecord[] }>("/api/encouragements?direction=received", undefined, currentUser), request<{ entries: FocusLeaderboardEntry[] }>("/api/leaderboards/focus", undefined, currentUser),
    ]);
    setBalance(nextBalance); setBoards({ week: uniqueLeaderboardEntries(weekly.entries), month: uniqueLeaderboardEntries(monthly.entries) }); setFriends(uniqueById(friendResponse.friends)); setReceived(receivedResponse.encouragements); setFocusBoard(focusResponse.entries);
  }, [currentUser]);

  /* eslint-disable react-hooks/set-state-in-effect -- reset is tied to account hydration */
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setBusy("initial"); setNotice(null);
    void load().catch((error) => { if (active) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to load community." }); }).finally(() => { if (active) setBusy(null); });
    const interval = window.setInterval(() => {
      void load().catch(() => { /* Keep the last successful community state visible. */ });
    }, 12_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [currentUser, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) { setResults([]); return; }
    setBusy("search"); setNotice(null);
    try { setResults(uniqueById((await request<{ users: CommunityUser[] }>(`/api/users/search?q=${encodeURIComponent(query)}`)).users)); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Search failed." }); }
    finally { setBusy(null); }
  }

  async function addFriend(user: CommunityUser) {
    setBusy(user.id); setNotice(null);
    try { await request("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) }, currentUser); setNotice({ kind: "success", message: `${user.name} is now your friend.` }); setResults((items) => items.filter((item) => item.id !== user.id)); await load(); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to add friend." }); }
    finally { setBusy(null); }
  }

  async function sendEncouragement(friend: CommunityUser) {
    setBusy(friend.id); setNotice(null);
    try { const result = await request<{ balance: EncouragementBalance }>("/api/encouragements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId: friend.id, recipientName: friend.name }) }, currentUser); setBalance(result.balance); setNotice({ kind: "success", message: `Encouragement sent to ${friend.name}. +4 community XP.` }); await load(); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to send encouragement." }); }
    finally { setBusy(null); }
  }

  async function completeTask() {
    if (!activeTask || !currentUser) return;
    setBusy("task"); setNotice(null);
    try { const result = await request<{ balance: EncouragementBalance; encouragementPointsAwarded: number }>("/api/tasks/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: `wellbeing-${currentUser.id}-${Date.now()}` }) }, currentUser); setBalance(result.balance); setActiveTask(null); setNotice({ kind: "success", message: result.encouragementPointsAwarded ? "Task completed. You earned an encouragement point." : "Task completed." }); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to complete the task." }); }
    finally { setBusy(null); }
  }

  if (!currentUser) return <DemoLogin />;
  const friendIds = new Set(friends.map((friend) => friend.id));

  return <div className="space-y-6">
    <nav className="sticky top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 shadow-sm backdrop-blur"><a href="#friends" className="rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink">Friends</a><a href="#leaderboards" className="rounded-xl bg-moss px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-moss-deep">Leaderboards</a><button onClick={() => void logout()} className="ml-auto rounded-xl border border-clay/30 px-3 py-2 text-xs font-semibold text-clay hover:bg-clay/10">Switch account</button></nav>
    <section className="grid gap-4 lg:grid-cols-3"><div className="card p-6"><p className="eyebrow">Logged in</p><div className="mt-3 flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-moss/15 font-bold text-moss">{currentUser.initials}</div><div><h2 className="text-lg font-bold">{currentUser.name}</h2><p className="text-xs text-faint">@{currentUser.username}</p></div></div></div><div className="card p-6"><p className="eyebrow">Available today</p><p className="tabular mt-3 text-4xl font-extrabold text-moss">{balance?.available ?? "—"}</p><p className="mt-1 text-sm text-muted">encouragements remaining</p></div><div className="card p-6"><p className="eyebrow">Wellbeing task</p><p className="mt-3 text-sm text-muted">{activeTask ?? "Choose a small action for yourself."}</p><div className="mt-4 flex gap-2"><button onClick={() => setActiveTask(WELLBEING_TASKS[Math.floor(Math.random() * WELLBEING_TASKS.length)])} className="rounded-xl bg-moss px-3 py-2 text-xs font-bold text-white">{activeTask ? "Another task" : "Choose task"}</button>{activeTask && <button onClick={() => void completeTask()} disabled={busy !== null} className="rounded-xl border border-moss/30 px-3 py-2 text-xs font-bold text-moss">Complete</button>}</div></div></section>
    {notice && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-moss/30 bg-moss/10 text-moss" : "border-clay/30 bg-clay/10 text-clay"}`}>{notice.message}</p>}
    <section id="friends" className="card p-6"><p className="eyebrow">Friends</p><h2 className="mt-1 text-xl font-bold">Find people to encourage</h2><form onSubmit={search} className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Search by username" className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm" /><button disabled={busy !== null} className="rounded-xl bg-moss px-4 py-3 text-sm font-bold text-white">Search</button></form>{results.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{results.map((user) => <UserCard key={user.id} user={user} action={friendIds.has(user.id) ? "Friend" : "Add friend"} disabled={busy !== null || friendIds.has(user.id)} onClick={() => void addFriend(user)} />)}</div>}<div className="mt-6 border-t border-line-soft pt-5"><p className="eyebrow">Your friends</p>{friends.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{friends.map((friend) => <UserCard key={friend.id} user={friend} action={busy === friend.id ? "Sending…" : "Send encouragement"} disabled={busy !== null || !balance?.available} onClick={() => void sendEncouragement(friend)} />)}</div> : <p className="mt-3 text-sm text-muted">Search for a registered user to add your first friend.</p>}</div></section>
    <section id="leaderboards" className="grid gap-6 lg:grid-cols-2"><div className="card overflow-hidden"><div className="border-b border-line-soft p-6"><p className="eyebrow">Encouragement feed</p><h2 className="mt-1 text-xl font-bold">Your friends are cheering you on</h2><p className="mt-2 text-sm text-muted">New messages appear here automatically.</p></div>{received.length ? <div className="divide-y divide-line-soft">{received.map((item) => <article key={item.id} className="p-5"><p className="font-bold">{item.senderName}</p><p className="mt-1 text-sm text-muted">“{item.message}”</p></article>)}</div> : <p className="p-8 text-center text-sm text-muted">No encouragements yet — invite a friend to send one.</p>}</div><div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line-soft p-6"><div><p className="eyebrow">Leaderboard</p><h2 className="mt-1 text-xl font-bold">Community momentum</h2></div><div className="flex rounded-xl bg-surface-2 p-1">{(["week", "month"] as const).map((tab) => <button key={tab} onClick={() => setPeriod(tab)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === tab ? "bg-moss text-white" : "text-muted"}`}>{tab}</button>)}</div></div>{boards[period].length ? <div className="divide-y divide-line-soft">{boards[period].map((entry) => <div key={entry.userId} className="flex items-center justify-between px-5 py-4"><span className="font-semibold">#{entry.rank} {entry.displayName}{entry.userId === currentUser.id ? " (You)" : ""}</span><span className="tabular font-bold text-moss">{entry.score}</span></div>)}</div> : <p className="p-8 text-center text-sm text-muted">Complete a task to join the leaderboard.</p>}</div></section>
    <FocusLeaderboard entries={focusBoard} />
  </div>;
}

function UserCard({ user, action, disabled, onClick }: { user: CommunityUser; action: string; disabled: boolean; onClick: () => void }) {
  const isEncouragement = action.includes("encouragement") || action === "Sendingâ€¦";
  return <article className="flex items-center gap-3 rounded-2xl border border-line-soft bg-surface-2 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-citrus/10 text-xs font-bold text-citrus">{user.initials}</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{user.name}</h3><p className="truncate text-xs text-faint">@{user.username}</p>{isEncouragement && <XpReward amount={4} label="community XP" className="mt-2" />}</div><button onClick={onClick} disabled={disabled} className="rounded-xl border border-moss/30 bg-moss/10 px-3 py-2 text-xs font-bold text-moss disabled:border-line disabled:text-faint">{action}</button></article>;
}

function FocusLeaderboard({ entries }: { entries: FocusLeaderboardEntry[] }) {
  return <div className="card overflow-hidden lg:col-span-2"><div className="border-b border-line-soft p-6"><p className="eyebrow">Friends&apos; focus</p><h2 className="mt-1 text-xl font-bold">Time focused, side by side</h2><p className="mt-2 text-sm text-muted">Verified focus versus the remainder of completed study sessions.</p></div>{entries.length ? <div className="divide-y divide-line-soft">{entries.map((entry) => <div key={entry.userId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4"><span className="truncate font-semibold">#{entry.rank} {entry.displayName}</span><span className="tabular text-right text-sm"><b className="text-moss">{formatCompact(entry.focusedMs)}</b><span className="block text-xs text-muted">focused</span></span><span className="tabular text-right text-sm"><b className="text-clay">{formatCompact(entry.unfocusedMs)}</b><span className="block text-xs text-muted">not focused</span></span></div>)}</div> : <p className="p-8 text-center text-sm text-muted">Add friends once they have completed a study session to compare focus time.</p>}</div>;
}
