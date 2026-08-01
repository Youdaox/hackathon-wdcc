"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EncouragementBalance,
  EncouragementHistoryRecord,
  LeaderboardEntry,
} from "@/lib/leaderboard/types";

type DemoUser = { id: string; name: string; initials: string };
type Period = "week" | "month";
type HistoryTab = "received" | "sent";
type Notice = { kind: "success" | "error"; message: string } | null;

const USERS: DemoUser[] = [
  { id: "user-1", name: "Alice", initials: "AL" },
  { id: "user-2", name: "Bob", initials: "BO" },
  { id: "user-3", name: "Charlie", initials: "CH" },
  { id: "user-4", name: "Diana", initials: "DI" },
  { id: "user-5", name: "Ethan", initials: "ET" },
];

const WELLBEING_TASKS = [
  "Take three deep breaths",
  "Look into the distance",
  "Stand up and stretch",
  "Drink some water",
] as const;

interface LeaderboardResponse { entries: LeaderboardEntry[] }

async function request<T>(url: string, user: DemoUser, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "x-user-id": user.id, "x-user-name": user.name, ...init?.headers },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const apiError = body as { error?: { message?: string } };
    throw new Error(apiError.error?.message ?? "Something went wrong. Please try again.");
  }
  return body as T;
}

export function EncouragementDashboard() {
  const [currentUser, setCurrentUser] = useState(USERS[0]);
  const [balance, setBalance] = useState<EncouragementBalance | null>(null);
  const [received, setReceived] = useState<EncouragementHistoryRecord[]>([]);
  const [sent, setSent] = useState<EncouragementHistoryRecord[]>([]);
  const [boards, setBoards] = useState<Record<Period, LeaderboardEntry[]>>({ week: [], month: [] });
  const [period, setPeriod] = useState<Period>("week");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("received");
  const [notice, setNotice] = useState<Notice>(null);
  const [toast, setToast] = useState<EncouragementHistoryRecord | null>(null);
  const [busy, setBusy] = useState<string | null>("initial");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [customTask, setCustomTask] = useState("");
  const seenReceived = useRef(new Set<string>());
  const historyReady = useRef(false);

  const loadHistory = useCallback(async (user: DemoUser, detectNew: boolean) => {
    const [receivedResponse, sentResponse] = await Promise.all([
      request<{ encouragements: EncouragementHistoryRecord[] }>("/api/encouragements?direction=received&limit=50", user),
      request<{ encouragements: EncouragementHistoryRecord[] }>("/api/encouragements?direction=sent&limit=50", user),
    ]);
    if (detectNew && historyReady.current) {
      const newest = receivedResponse.encouragements.find((item) => !seenReceived.current.has(item.id));
      if (newest) setToast(newest);
    }
    receivedResponse.encouragements.forEach((item) => seenReceived.current.add(item.id));
    historyReady.current = true;
    setReceived(receivedResponse.encouragements);
    setSent(sentResponse.encouragements);
  }, []);

  const loadDashboard = useCallback(async (user: DemoUser) => {
    const [nextBalance, weekly, monthly] = await Promise.all([
      request<EncouragementBalance>("/api/encouragements/balance", user),
      request<LeaderboardResponse>("/api/leaderboards?period=week", user),
      request<LeaderboardResponse>("/api/leaderboards?period=month", user),
    ]);
    setBalance(nextBalance);
    setBoards({ week: weekly.entries, month: monthly.entries });
  }, []);

  useEffect(() => {
    let active = true;
    async function initialise() {
      setBusy("initial");
      setNotice(null);
      setToast(null);
      seenReceived.current = new Set();
      historyReady.current = false;
      try {
        await request("/api/demo/seed", currentUser, { method: "POST" });
        if (!active) return;
        await Promise.all([loadDashboard(currentUser), loadHistory(currentUser, false)]);
      } catch (error) {
        if (active) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to load the demo." });
      } finally {
        if (active) setBusy(null);
      }
    }
    void initialise();
    return () => { active = false; };
  }, [currentUser, loadDashboard, loadHistory]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadHistory(currentUser, true).catch(() => undefined);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [currentUser, loadHistory]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function sendEncouragement(recipient: DemoUser) {
    setBusy(recipient.id);
    setNotice(null);
    try {
      const result = await request<{ balance: EncouragementBalance }>("/api/encouragements", currentUser, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, recipientName: recipient.name }),
      });
      setBalance(result.balance);
      setNotice({ kind: "success", message: `Encouragement sent to ${recipient.name}.` });
      await Promise.all([loadHistory(currentUser, false), loadDashboard(currentUser)]);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to send encouragement." });
    } finally { setBusy(null); }
  }

  function showRandomTask() {
    const next = WELLBEING_TASKS[Math.floor(Math.random() * WELLBEING_TASKS.length)];
    setActiveTask(next);
    setNotice(null);
  }

  function createCustomTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = customTask.trim();
    if (!next) return;
    setActiveTask(next.slice(0, 120));
    setCustomTask("");
    setNotice({ kind: "success", message: "Your custom task is ready." });
  }

  async function completeTask() {
    if (!activeTask) return;
    setBusy("task");
    setNotice(null);
    try {
      const result = await request<{
        balance: EncouragementBalance;
        encouragementPointsAwarded: number;
      }>("/api/tasks/complete", currentUser, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: `wellbeing-${currentUser.id}-${Date.now()}` }),
      });
      setBalance(result.balance);
      setActiveTask(null);
      setNotice({
        kind: "success",
        message: result.encouragementPointsAwarded > 0
          ? `Task completed. You earned ${result.encouragementPointsAwarded} encouragement point.`
          : "Task completed. Your 15-point challenge is already complete, so no extra point was added.",
      });
      await loadDashboard(currentUser);
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Unable to complete the task." });
    } finally { setBusy(null); }
  }

  const history = historyTab === "received" ? received : sent;
  const otherUsers = USERS.filter((user) => user.id !== currentUser.id);

  return (
    <div className="space-y-6">
      {toast && <div role="status" className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm animate-rise rounded-2xl border border-moss/40 bg-surface p-5 shadow-2xl shadow-black/40"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-moss/15 font-bold text-moss">♥</div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-moss">New encouragement from {toast.senderName}</p><p className="mt-2 text-sm leading-relaxed text-ink">“{toast.message}”</p></div><button onClick={() => setToast(null)} className="text-faint hover:text-ink" aria-label="Dismiss notification">×</button></div></div>}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.8fr_1fr]">
        <div className="card p-6"><label htmlFor="demo-user" className="eyebrow">Demo user</label><div className="mt-3 flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-moss/15 font-bold text-moss">{currentUser.initials}</div><div className="min-w-0 flex-1"><select id="demo-user" value={currentUser.id} onChange={(event) => setCurrentUser(USERS.find((user) => user.id === event.target.value) ?? USERS[0])} className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-semibold text-ink"><option value="user-1">Alice</option><option value="user-2">Bob</option><option value="user-3">Charlie</option><option value="user-4">Diana</option><option value="user-5">Ethan</option></select><p className="mt-1 text-xs text-faint">Switch users to demo both sides of a message.</p></div></div></div>
        <div className="card p-6"><p className="eyebrow">Available today</p><p className="tabular mt-3 text-4xl font-extrabold text-moss">{balance?.available ?? "—"}</p><p className="mt-1 text-sm text-muted">encouragements remaining</p>{balance && <p className="mt-3 text-xs text-faint">{balance.base} base + {balance.earned} earned − {balance.used} sent</p>}</div>
        <div className="card p-6">
          {balance && balance.taskPoints >= balance.maxTaskPoints ? (
            <div className="flex h-full items-center gap-4 rounded-2xl border border-citrus/30 bg-citrus/10 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-citrus text-2xl text-citrus">★</div>
              <div><p className="eyebrow text-citrus">Challenge complete</p><h2 className="mt-1 text-lg font-bold">Wellbeing Champion</h2><p className="mt-1 text-xs text-muted">15 / 15 points earned. You can still complete tasks.</p><button onClick={showRandomTask} className="mt-3 text-xs font-bold text-citrus hover:underline">Choose another task</button></div>
            </div>
          ) : (
            <div><div className="flex items-center justify-between"><p className="eyebrow">Wellbeing challenge</p><span className="tabular text-sm font-bold text-moss">{balance?.taskPoints ?? 0} / {balance?.maxTaskPoints ?? 15}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${((balance?.taskPoints ?? 0) / (balance?.maxTaskPoints ?? 15)) * 100}%` }} /></div><button onClick={showRandomTask} disabled={busy !== null} className="mt-4 w-full rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-canvas hover:bg-citrus disabled:opacity-50">Show Demo Task</button></div>
          )}
        </div>
      </section>

      <section className="card p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div><p className="eyebrow">Current task</p>{activeTask ? <div className="mt-3 rounded-2xl border border-moss/25 bg-moss/[0.07] p-5"><h2 className="text-xl font-bold">{activeTask}</h2><p className="mt-1 text-sm text-muted">Take a moment for yourself, then mark it complete.</p><div className="mt-4 flex gap-2"><button onClick={completeTask} disabled={busy !== null} className="rounded-xl bg-moss px-4 py-2.5 text-sm font-bold text-canvas disabled:opacity-50">{busy === "task" ? "Completing…" : "Complete Task"}</button><button onClick={showRandomTask} disabled={busy !== null} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink">Try another</button></div></div> : <div className="mt-3 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Choose a random demo task or create your own.</div>}</div>
          <form onSubmit={createCustomTask}><label htmlFor="custom-task" className="eyebrow">Create your own</label><p className="mt-2 text-sm text-muted">Add a small wellbeing action that works for you.</p><input id="custom-task" value={customTask} onChange={(event) => setCustomTask(event.target.value)} maxLength={120} placeholder="e.g. Walk outside for two minutes" className="mt-4 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-faint" /><button type="submit" disabled={!customTask.trim()} className="mt-3 rounded-xl border border-moss/30 bg-moss/10 px-4 py-2.5 text-sm font-bold text-moss disabled:opacity-50">Create Task</button></form>
        </div>
      </section>

      {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.kind === "success" ? "border-moss/30 bg-moss/10 text-moss" : "border-clay/30 bg-clay/10 text-clay"}`}>{notice.message}</div>}

      <section className="card p-6"><p className="eyebrow">Share support</p><h2 className="mt-1 text-xl font-bold">Encourage someone</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{otherUsers.map((user) => <article key={user.id} className="rounded-2xl border border-line-soft bg-surface-2 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-citrus/10 text-xs font-bold text-citrus">{user.initials}</div><h3 className="mt-3 font-bold">{user.name}</h3><p className="text-xs text-faint">{user.id}</p><button onClick={() => sendEncouragement(user)} disabled={busy !== null || !balance?.available} className="mt-4 w-full rounded-xl border border-moss/30 bg-moss/10 px-3 py-2 text-xs font-bold text-moss hover:bg-moss/20 disabled:border-line disabled:text-faint disabled:opacity-60">{busy === user.id ? "Sending…" : "Send Encouragement"}</button></article>)}</div></section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card overflow-hidden"><div className="border-b border-line-soft p-6"><p className="eyebrow">Encouragement history</p><div className="mt-4 flex rounded-xl bg-surface-2 p-1">{(["received", "sent"] as const).map((tab) => <button key={tab} onClick={() => setHistoryTab(tab)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${historyTab === tab ? "bg-moss text-canvas" : "text-muted hover:text-ink"}`}>{tab === "received" ? "Who Encouraged You" : "Who You Encouraged"}</button>)}</div></div><div className="max-h-[28rem] divide-y divide-line-soft overflow-y-auto">{history.length ? history.map((item) => <article key={item.id} className="p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{historyTab === "received" ? item.senderName : item.recipientName}</p><time className="shrink-0 text-[11px] text-faint">{new Date(item.createdAt).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}</time></div><p className="mt-2 text-sm leading-relaxed text-muted">“{item.message}”</p></article>) : <p className="p-8 text-center text-sm text-muted">No encouragements here yet.</p>}</div></div>

        <div className="card overflow-hidden"><div className="flex flex-col gap-4 border-b border-line-soft p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="eyebrow">Leaderboard</p><h2 className="mt-1 text-xl font-bold">Community momentum</h2></div><div className="flex rounded-xl bg-surface-2 p-1">{(["week", "month"] as const).map((tab) => <button key={tab} onClick={() => setPeriod(tab)} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${period === tab ? "bg-moss text-canvas" : "text-muted hover:text-ink"}`}>{tab === "week" ? "Weekly" : "Monthly"}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left"><thead><tr className="border-b border-line-soft text-xs uppercase tracking-wider text-faint"><th className="px-5 py-3">Rank</th><th className="px-3 py-3">User</th><th className="px-3 py-3 text-center">Received</th><th className="px-5 py-3 text-right">Score</th></tr></thead><tbody>{boards[period].map((entry) => <tr key={entry.userId} className={`border-b border-line-soft last:border-0 ${entry.userId === currentUser.id ? "bg-moss/[0.07]" : ""}`}><td className="tabular px-5 py-4 font-bold text-citrus">#{entry.rank}</td><td className="px-3 py-4 font-semibold">{entry.displayName}{entry.userId === currentUser.id && <span className="ml-2 rounded-full bg-moss/15 px-2 py-0.5 text-[10px] uppercase text-moss">You</span>}</td><td className="tabular px-3 py-4 text-center text-muted">{entry.encouragementsReceived}</td><td className="tabular px-5 py-4 text-right font-bold">{entry.score}</td></tr>)}</tbody></table>{!boards[period].length && <p className="p-8 text-center text-sm text-muted">{busy === "initial" ? "Loading rankings…" : "No ranking data yet."}</p>}</div></div>
      </section>
    </div>
  );
}
