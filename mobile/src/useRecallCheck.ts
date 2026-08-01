import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRecallQuestion, type RecallQuestion } from "./api";

/**
 * Mid-session recall check, ported from the web `useRecallCheck`.
 *
 * Fires once per session at a random point past the minimum, so it can't be
 * anticipated and gamed. The timer never stops for it — the card is one tap to
 * dismiss, because a quiz that blocks a study session is a quiz people learn
 * to resent.
 */

/** Don't interrupt until the user has actually settled into the session. */
const MIN_FOCUSED_MS = 3 * 60_000;
/** The check lands somewhere in this window past the minimum. */
const WINDOW_MS = 7 * 60_000;

export type RecallState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "asking"; question: RecallQuestion }
  | { status: "answered"; question: RecallQuestion; chosen: number; correct: boolean };

export function useRecallCheck(params: {
  running: boolean;
  focusedMs: number;
  course: string;
  onCorrect: (bonusXp: number) => void;
}) {
  const { running, focusedMs, course, onCorrect } = params;
  const [state, setState] = useState<RecallState>({ status: "idle" });

  /** Randomised once per session so the timing can't be learned. */
  const threshold = useRef<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!running) {
      threshold.current = null;
      fired.current = false;
      setState({ status: "idle" });
      return;
    }
    if (threshold.current === null) {
      threshold.current = MIN_FOCUSED_MS + Math.random() * WINDOW_MS;
    }
  }, [running]);

  useEffect(() => {
    if (!running || fired.current) return;
    if (threshold.current === null || focusedMs < threshold.current) return;

    fired.current = true;
    setState({ status: "loading" });
    void fetchRecallQuestion(course)
      .then((question) => setState({ status: "asking", question }))
      // The route already falls back to a built-in question, so a failure here
      // means the network died — drop the check rather than surface an error
      // mid-session.
      .catch(() => setState({ status: "idle" }));
  }, [running, focusedMs, course]);

  const answer = useCallback(
    (chosen: number) => {
      setState((current) => {
        if (current.status !== "asking") return current;
        const correct = chosen === current.question.correctIndex;
        if (correct) onCorrect(10);
        return { status: "answered", question: current.question, chosen, correct };
      });
    },
    [onCorrect],
  );

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  return { state, answer, dismiss };
}
