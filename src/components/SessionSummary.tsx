"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useIncline } from "@/lib/store";
import { MOOD_LABEL, levelProgress, moodFor, reactionFor } from "@/lib/companion";
import { formatCompact } from "@/lib/time";
import { AnimalSprite } from "@/components/AnimalSprite";
import { FocusTimeline } from "@/components/FocusTimeline";
import { XpReward } from "@/components/XpReward";

export function SessionSummary() {
  const { outcome, dismissOutcome } = useIncline();

  useEffect(() => {
    if (!outcome) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissOutcome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outcome, dismissOutcome]);

  if (!outcome) return null;

  const { session, growth } = outcome;
  const mood = moodFor(growth.companion.hp);
  const progress = levelProgress(growth.companion);
  const total = session.focusedMs + session.distractedMs;
  const focusPct = total > 0 ? Math.round((session.focusedMs / total) * 100) : 0;
  const penalized = session.distractions.filter((d) => d.penalized).length;
  const gazeDrifts = session.distractions.filter((d) => d.reason === "gaze").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
      onClick={dismissOutcome}
    >
      <div
        className="card animate-rise w-full max-w-lg p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow">Session complete</div>
        <h2 className="mt-2 text-2xl font-extrabold">{session.title}</h2>

        <div className="relative mt-6 flex items-center justify-center">
          {growth.levelsGained > 0 && (
            <span className="absolute -top-1 right-1/2 mr-14 rounded-full bg-citrus px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-canvas">
              Level up
            </span>
          )}
          <AnimalSprite
            species={growth.companion.species}
            mood={mood}
            level={growth.companion.level}
            color={growth.companion.color}
            accessory={growth.companion.accessory}
            hp={growth.companion.hp}
            size={110}
          />
        </div>

        <p className="mx-auto mt-4 max-w-sm text-sm text-muted">
          {reactionFor(growth, penalized, session.focusedMs)}
        </p>

        <div className="mt-7 grid grid-cols-3 gap-3">
          <Stat label="Focused" value={formatCompact(session.focusedMs)} accent="text-moss" />
          <Stat label="Away" value={formatCompact(session.distractedMs)} accent="text-clay" />
          <div className="rounded-xl bg-surface-2/60 px-3 py-4">
            <XpReward amount={session.xpEarned} className="text-base" />
            <div className="eyebrow mt-1">XP gained</div>
          </div>
        </div>

        <div className="mt-6 text-left">
          <FocusTimeline
            startedAt={session.startedAt}
            endedAt={session.endedAt}
            distractions={session.distractions}
          />
        </div>

        <div className="mt-6 space-y-3 rounded-xl bg-surface-2/60 px-4 py-4 text-left">
          <Row label="Verified focus" value={`${focusPct}% of ${formatCompact(session.totalMs)}`} />
          <Row
            label="Distractions"
            value={penalized === 0 ? "None — clean run" : `${penalized} logged`}
            accent={penalized === 0 ? "text-moss" : "text-amber"}
          />
          <Row
            label={`${growth.companion.name}'s health`}
            value={`${Math.round(growth.companion.hp)}% · ${MOOD_LABEL[mood]}${
              session.hpDelta !== 0 ? ` (${session.hpDelta > 0 ? "+" : ""}${session.hpDelta})` : ""
            }`}
            accent={session.hpDelta < 0 ? "text-clay" : "text-moss"}
          />
          {gazeDrifts > 0 && (
            <Row
              label="Eyes wandered"
              value={`${gazeDrifts} time${gazeDrifts === 1 ? "" : "s"}`}
              accent="text-amber"
            />
          )}
          {session.bonusXp > 0 && (
            <Row
              label="Recall check"
              value={`+${session.bonusXp} XP · answered right`}
              accent="text-citrus"
            />
          )}
          {session.xpMultiplier > 1 && (
            <Row
              label="Location bonus"
              value={`${session.xpMultiplier}× · ${session.zoneName ?? "Bonus zone"}`}
              accent="text-citrus"
            />
          )}
          {session.emotionalXpMultiplier !== 1 && (
            <Row
              label="Check-in effect"
              value={`${session.emotionalXpMultiplier}× XP · ${session.hpLossMultiplier}× health loss`}
              accent={session.emotionalXpMultiplier > 1 ? "text-moss" : "text-amber"}
            />
          )}
          <Row
            label="Progress"
            value={`Level ${growth.companion.level} · ${progress.xp}/${progress.needed} XP`}
          />
        </div>

        <Button size="lg" className="mt-7 w-full" onClick={dismissOutcome} autoFocus>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-4">
      <div className={`tabular font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tabular font-semibold ${accent ?? "text-ink"}`}>{value}</span>
    </div>
  );
}
