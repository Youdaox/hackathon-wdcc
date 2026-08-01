"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveSession } from "@/lib/types";
import type { RecallQuestion } from "@/lib/recall";

/** Don't interrupt until the user has actually settled into the session. */
const MIN_FOCUSED_MS = 3 * 60_000;
/** The check lands somewhere in this window past the minimum. */
const WINDOW_MS = 7 * 60_000;

export type RecallState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "asking"; question: RecallQuestion }
  | { status: "answered"; question: RecallQuestion; chosen: number; correct: boolean };

const IDLE: RecallState = { status: "idle" };

/** State is stamped with its session so it expires by derivation, not cleanup. */
interface Entry {
  sessionId: string;
  state: RecallState;
}

/**
 * Fires at most one recall check per session, at a random point once the user
 * has some focused time behind them.
 *
 * Deliberately unobtrusive: it never blocks the timer, dismissing costs
 * nothing, and a failed fetch just means no question this session.
 */
export function useRecallCheck(active: ActiveSession | null, onCorrect: () => void) {
  const [entry, setEntry] = useState<Entry | null>(null);

  /** Session id we've already fired for, so each session gets at most one. */
  const firedFor = useRef<string | null>(null);
  /** Focus threshold for the current session, rolled once when it starts. */
  const threshold = useRef<number>(0);
  const currentSession = useRef<string | null>(null);
  const entryRef = useRef<Entry | null>(null);
  const onCorrectRef = useRef(onCorrect);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  useEffect(() => {
    onCorrectRef.current = onCorrect;
  }, [onCorrect]);

  // Roll a fresh threshold whenever a new session starts.
  useEffect(() => {
    if (!active) {
      currentSession.current = null;
      return;
    }
    if (currentSession.current !== active.id) {
      currentSession.current = active.id;
      threshold.current = MIN_FOCUSED_MS + Math.random() * WINDOW_MS;
    }
  }, [active]);

  const fetchQuestion = useCallback(async (sessionId: string, course: string) => {
    setEntry({ sessionId, state: { status: "loading" } });
    try {
      const response = await fetch("/api/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course }),
      });
      if (!response.ok) throw new Error(`recall request failed: ${response.status}`);
      const question = (await response.json()) as RecallQuestion;
      setEntry({ sessionId, state: { status: "asking", question } });
    } catch {
      // No question this session — never surface an error mid-focus.
      setEntry({ sessionId, state: IDLE });
    }
  }, []);

  // Trigger check. Re-runs on the session's 1s tick, via `active` changing.
  useEffect(() => {
    if (!active) return;
    if (firedFor.current === active.id) return;
    // They're away — hidden tab or eyes off screen — so wait until they're back.
    if (active.isHidden || active.isGazeAway) return;
    if (active.focusedMs < threshold.current) return;

    firedFor.current = active.id;
    void fetchQuestion(active.id, active.course);
  }, [active, fetchQuestion]);

  const answer = useCallback((chosen: number) => {
    const current = entryRef.current;
    if (!current || current.state.status !== "asking") return;
    const { question } = current.state;
    const correct = chosen === question.correctIndex;
    if (correct) onCorrectRef.current();
    setEntry({
      sessionId: current.sessionId,
      state: { status: "answered", question, chosen, correct },
    });
  }, []);

  const dismiss = useCallback(() => {
    const current = entryRef.current;
    if (current) setEntry({ sessionId: current.sessionId, state: IDLE });
  }, []);

  // Derived rather than cleared in an effect: state belonging to a finished
  // session simply stops matching, so no stale card can survive into the next.
  const state = entry && active && entry.sessionId === active.id ? entry.state : IDLE;

  return { state, answer, dismiss };
}
