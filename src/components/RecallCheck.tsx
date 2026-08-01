"use client";

import { useCallback } from "react";
import { useIncline } from "@/lib/store";
import { useRecallCheck } from "@/hooks/useRecallCheck";
import { RECALL_BONUS_XP } from "@/lib/recall";

/**
 * A single recall question, floated in the corner mid-session.
 *
 * Non-blocking on purpose: the timer keeps running, the card can be dismissed
 * with one click, and skipping costs nothing. It's a nudge, not a gate.
 */
export function RecallCheck() {
  const { active, addBonusXp } = useIncline();

  const onCorrect = useCallback(() => addBonusXp(RECALL_BONUS_XP), [addBonusXp]);
  const { state, answer, dismiss } = useRecallCheck(active, onCorrect);

  if (!active || state.status === "idle") return null;

  return (
    <div className="animate-rise fixed bottom-6 right-6 z-40 w-[min(24rem,calc(100vw-3rem))]">
      <div className="card border-citrus/30 p-5 shadow-2xl">
        {state.status === "loading" ? (
          <div className="flex items-center gap-3 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-citrus" />
            <span className="text-sm text-muted">Thinking up a quick question…</span>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="eyebrow text-citrus">
                Recall check
                {state.question.source === "offline" && (
                  <span className="ml-1.5 text-faint">· offline</span>
                )}
              </div>
              <button
                onClick={dismiss}
                className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold text-faint transition-colors hover:text-ink"
              >
                Skip
              </button>
            </div>

            <p className="text-sm font-semibold leading-snug">{state.question.question}</p>

            <div className="mt-4 space-y-1.5">
              {state.question.options.map((option, index) => {
                const answered = state.status === "answered";
                const isCorrect = index === state.question.correctIndex;
                const isChosen = answered && state.chosen === index;

                let tone = "border-line-soft bg-surface-2/50 hover:border-moss/50 hover:text-moss";
                if (answered && isCorrect) tone = "border-moss/60 bg-moss/10 text-moss";
                else if (isChosen) tone = "border-clay/50 bg-clay/10 text-clay";
                else if (answered) tone = "border-line-soft text-faint";

                return (
                  <button
                    key={option}
                    disabled={answered}
                    onClick={() => answer(index)}
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
                  >
                    <span className="w-4 shrink-0 text-xs font-bold opacity-60">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="min-w-0 flex-1">{option}</span>
                    {answered && isCorrect && <span className="shrink-0 text-xs">✓</span>}
                    {answered && isChosen && !isCorrect && <span className="shrink-0 text-xs">✕</span>}
                  </button>
                );
              })}
            </div>

            {state.status === "answered" && (
              <div className="animate-rise mt-4 border-t border-line-soft pt-3">
                <p className={`text-sm font-semibold ${state.correct ? "text-moss" : "text-amber"}`}>
                  {state.correct ? `Nice — +${RECALL_BONUS_XP} XP` : "Not quite — no harm done"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {state.question.explanation}
                </p>
                <button
                  onClick={dismiss}
                  className="mt-3 text-xs font-semibold text-faint transition-colors hover:text-ink"
                >
                  Back to focus
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
