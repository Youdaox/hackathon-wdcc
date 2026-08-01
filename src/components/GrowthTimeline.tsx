"use client";

import { Pig, stageForLevel, STAGE_LABEL } from "@/components/Pig";
import { avatarStateFor, levelProgress, moodFor } from "@/lib/companion";
import { useIncline } from "@/lib/store";

const MILESTONES = [1, 3, 5, 7, 9];

/** The same avatar states used on the companion card, shown across milestones. */
export function GrowthTimeline() {
  const { companion } = useIncline();
  const progress = levelProgress(companion);
  const mood = moodFor(companion.hp);
  const state = avatarStateFor(companion.hp, companion.checkInEmotion);

  return (
    <section className="card p-6" aria-label="Companion growth timeline">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Growth timeline</p>
          <h2 className="mt-1 font-display text-xl font-bold">{companion.name}&apos;s journey</h2>
        </div>
        <span className="rounded-full bg-moss/10 px-2.5 py-1 text-xs font-semibold capitalize text-moss">
          {state.replace("-", " ")}
        </span>
      </div>
      <div className="mt-5 flex items-start justify-between gap-1">
        {MILESTONES.map((level) => {
          const reached = companion.level >= level;
          return (
            <div key={level} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${reached ? "border-moss bg-moss/10" : "border-line bg-surface-2 opacity-55"}`}>
                <Pig mood={mood} level={level} color={companion.color} accessory={level === companion.level ? companion.accessory : "none"} hp={reached ? companion.hp : 100} emotion={level === companion.level ? companion.checkInEmotion : null} size={40} />
              </div>
              <span className="mt-2 text-[10px] font-semibold text-muted">Lv {level}</span>
              <span className="hidden text-[10px] text-faint sm:block">{STAGE_LABEL[stageForLevel(level)]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-moss transition-[width] duration-700" style={{ width: `${progress.pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-faint">{progress.xp} / {progress.needed} XP to the next chapter</p>
    </section>
  );
}
