import { Platform } from "react-native";
import { API_BASE_URL } from "./config";
import { authHeader } from "./auth";

/**
 ios | ios | web, which is what
 * Platform.OS reports on every target Expo Go runs on.
 */
const PLATFORM = Platform.OS === "web" ? "web" : "ios";

/**
 * Client for the Incline sync API.
 *
 * Mirrors the wire contract in `src/lib/api/contract.ts` on the server: ISO8601
 * timestamps, `duration_seconds`, snake_case. The conversion from the app's
 * internal milliseconds happens here, at the boundary, so the rest of the app
 * only ever deals in numbers.
 */

export type PigColor = "pink" | "purple" | "blue";
export type PigAccessory = "none" | "glasses" | "flower";
export type AvatarEmotion = "happy" | "sad" | "angry" | "calm" | "excited";

export interface Companion {
  name: string;
  species: string;
  color: PigColor;
  accessory: PigAccessory;
  check_in_emotion: AvatarEmotion | null;
  next_check_in_at: string | null;
  level: number;
  xp: number;
  xp_needed: number;
  hp: number;
  mood: "happy" | "neutral" | "sad" | "sick";
  total_focused_ms: number;
  last_session_at: string | null;
}

export interface StudySpot {
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  multiplier: number;
}

export interface DistractionRecord {
  startedAt: number;
  durationMs: number;
  /** True when the user pushed past the intercept screen. */
  bypassed?: boolean;
  /** What the user said on the return check-in. Null if they weren't asked. */
  reason?: AwayReason | null;
  /** Their guess, in seconds, before the real number was revealed. */
  guessedSeconds?: number | null;
}

/**
 * Why the user left. Only "distraction" costs HP — the server decides that,
 * the client just reports what was said.
 */
export type AwayReason = "emergency" | "task" | "offline" | "distraction" | "ended";

export interface SessionResult {
  session_id: string;
  pet_growth_delta: number;
  voided: boolean;
  void_reason: "left-early" | "distracted" | null;
}

const TIMEOUT_MS = 8_000;

/**
 * fetch with a timeout. Without one, a phone on campus wifi that can't reach
 * the laptop hangs on a spinner instead of failing and letting the session end.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      // The session cookie rides on every call so the server resolves the same
      // account the desktop app uses.
      headers: { "Content-Type": "application/json", ...authHeader(), ...init?.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? `request failed (${response.status})`);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchCompanion(): Promise<Companion> {
  return request<Companion>("/api/companion");
}

export async function fetchStudySpots(): Promise<StudySpot[]> {
  const body = await request<{ spots: StudySpot[] }>(
    "/api/study-spots",
  );
  return body.spots;
}

/**
 * Posts a finished session. The server computes growth — this returns what the
 * pet actually gained, which is not something the app tries to predict.
 *
 * The app can see that the user left Incline, never where they went — iOS does
 * not disclose that to third-party apps.
 */
export function postSession(params: {
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  locationName: string | null;
  pledgeMinutes: number;
  bonusXp: number;
  distractions: DistractionRecord[];
}): Promise<SessionResult> {
  return request<SessionResult>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      start_time: new Date(params.startedAt).toISOString(),
      end_time: new Date(params.endedAt).toISOString(),
      verified_minutes: params.focusedMs / 60_000,
      location_verified: params.locationName !== null,
      location_name: params.locationName,
      platform: PLATFORM,
      committed_minutes: params.pledgeMinutes,
      bonus_xp: params.bonusXp,
      distraction_events: params.distractions.map((d) => ({
        timestamp: new Date(d.startedAt).toISOString(),
        duration_seconds: d.durationMs / 1000,
        bypassed: d.bypassed ?? false,
        reason: d.reason ?? null,
        guessed_seconds: d.guessedSeconds ?? null,
      })),
    }),
  });
}


/**
 * Logs a check-in answer the moment it's given, rather than waiting for the
 * session to end — a self-reported distraction shouldn't be lost if the
 * session never ends cleanly.
 */
export function logDistractionEvent(event: {
  durationMs: number;
  reason?: AwayReason | null;
  guessedSeconds?: number | null;
}): Promise<{ event_id: string }> {
  return request<{ event_id: string }>("/api/distraction-events", {
    method: "POST",
    body: JSON.stringify({
      session_id: null,
      timestamp: new Date().toISOString(),
      duration_seconds: event.durationMs / 1000,
      reason: event.reason ?? null,
      guessed_seconds: event.guessedSeconds ?? null,
    }),
  });
}

export interface RecapDay {
  date: string;
  label: string;
  focused_minutes: number;
  distracted_minutes: number;
  sessions: number;
}

export interface Recap {
  days: RecapDay[];
  reasons: Record<AwayReason, number>;
  study_days: number;
  streak: number;
  total_focused_minutes: number;
  total_distracted_minutes: number;
  /** Positive means the user under-estimates how long they were gone. */
  guess_gap_seconds: number | null;
}

/** Updates coat, accessory, emotion or name. Growth stays server-owned. */
export function patchCompanion(patch: {
  color?: PigColor;
  accessory?: PigAccessory;
  check_in_emotion?: AvatarEmotion | null;
  name?: string;
}): Promise<{ ok: true }> {
  return request<{ ok: true }>("/api/companion", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function fetchRecap(): Promise<Recap> {
  return request<Recap>("/api/recap");
}

export interface RecallQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** "offline" means no API key was configured — the question is a built-in. */
  source: "ai" | "offline";
}

export function fetchRecallQuestion(course: string): Promise<RecallQuestion> {
  return request<RecallQuestion>("/api/recall", {
    method: "POST",
    body: JSON.stringify({ course }),
  });
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
  rank: number;
  tasksCompleted?: number;
  encouragementsReceived?: number;
}

export interface Leaderboard {
  period: "week" | "month";
  entries: LeaderboardEntry[];
}

export function fetchLeaderboard(period: "week" | "month" = "week"): Promise<Leaderboard> {
  return request<Leaderboard>(`/api/leaderboards?period=${period}&limit=20`);
}

export interface Friend {
  id: string;
  username: string;
  name: string;
  initials: string;
}

export interface Encouragement {
  id: string;
  /** Server-side local day, e.g. "2026-08-02". Used to scope "cheered today". */
  dayKey: string;
  message: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName?: string | null;
  createdAt: string;
}

export interface EncouragementBalance {
  /** Server-side local day, matching an Encouragement's dayKey. */
  date: string;
  available: number;
  base: number;
  earned: number;
  used: number;
  taskPoints: number;
  maxTaskPoints: number;
}

export interface DirectoryUser {
  id: string;
  username: string;
  name: string;
  initials: string;
}

export async function fetchFriends(): Promise<Friend[]> {
  const body = await request<{ friends: Friend[] }>("/api/friends");
  return body.friends;
}

export function addFriend(userId: string): Promise<unknown> {
  return request("/api/friends", { method: "POST", body: JSON.stringify({ userId }) });
}

export async function searchUsers(q: string): Promise<DirectoryUser[]> {
  const body = await request<{ users: DirectoryUser[] }>(
    `/api/users/search?q=${encodeURIComponent(q)}`,
  );
  return body.users;
}

export async function fetchEncouragements(
  direction: "received" | "sent" = "received",
): Promise<Encouragement[]> {
  const body = await request<{ encouragements: Encouragement[] }>(
    `/api/encouragements?direction=${direction}`,
  );
  return body.encouragements;
}

export function fetchEncouragementBalance(): Promise<EncouragementBalance> {
  return request<EncouragementBalance>("/api/encouragements/balance");
}

/** Sends one encouragement. The daily allowance is enforced server-side. */
export function sendEncouragement(recipientId: string, recipientName?: string): Promise<unknown> {
  return request("/api/encouragements", {
    method: "POST",
    body: JSON.stringify({ recipientId, recipientName }),
  });
}

export interface StudyBlock {
  id: string;
  title: string;
  course: string;
  start_min: number;
  end_min: number;
  days: number[];
  source: "manual" | "canvas";
}

export async function fetchSchedule(): Promise<StudyBlock[]> {
  const body = await request<{ blocks: StudyBlock[] }>("/api/schedule");
  return body.blocks;
}

export function createBlock(block: {
  title: string;
  course: string;
  start_min: number;
  end_min: number;
  days: number[];
}): Promise<{ id: string }> {
  return request<{ id: string }>("/api/schedule", {
    method: "POST",
    body: JSON.stringify(block),
  });
}

export function deleteBlock(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
