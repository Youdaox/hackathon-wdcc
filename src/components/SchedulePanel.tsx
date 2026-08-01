"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ScheduleBlockForm, type BlockDraft } from "@/components/ScheduleBlockForm";
import { useIncline } from "@/lib/store";
import { useNow } from "@/hooks/useNow";
import { DAY_LABELS, formatClock } from "@/lib/time";
import { blocksOnDay, findActiveBlock } from "@/lib/schedule";
import type { StudyBlock } from "@/lib/types";

export function SchedulePanel() {
  const { blocks, addBlock, updateBlock, removeBlock, active, startSession } = useIncline();
  const now = useNow();
  const [mode, setMode] = useState<"list" | "new" | { editing: string }>("list");
  const [viewDay, setViewDay] = useState<number | null>(null);

  // Default the day tabs to today, once the client clock is available.
  const selectedDay = viewDay ?? now?.getDay() ?? 0;
  const dayBlocks = blocksOnDay(blocks, selectedDay);
  const activeBlock = now ? (findActiveBlock(blocks, now)?.block ?? null) : null;
  const editingBlock =
    typeof mode === "object" ? blocks.find((b) => b.id === mode.editing) : undefined;

  const handleSubmit = (draft: BlockDraft) => {
    if (typeof mode === "object") {
      updateBlock(mode.editing, draft);
    } else {
      addBlock(draft);
    }
    setMode("list");
  };

  return (
    <section className="card flex flex-col p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Schedule</h2>
          <p className="mt-0.5 text-sm text-muted">
            Your weekly study blocks. Sessions can link to any of them.
          </p>
        </div>
        {mode === "list" && (
          <Button size="sm" variant="outline" onClick={() => setMode("new")}>
            + Block
          </Button>
        )}
      </header>

      <div className="mt-5">
        {mode !== "list" ? (
          <ScheduleBlockForm
            initial={editingBlock}
            onSubmit={handleSubmit}
            onCancel={() => setMode("list")}
          />
        ) : (
          <>
            <div className="mb-4 flex gap-1">
              {DAY_LABELS.map((label, day) => {
                const count = blocksOnDay(blocks, day).length;
                const selected = day === selectedDay;
                return (
                  <button
                    key={label}
                    onClick={() => setViewDay(day)}
                    className={`group flex-1 rounded-lg py-2 text-center transition-colors ${
                      selected ? "bg-surface-2 text-ink" : "text-faint hover:text-muted"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{label[0]}</span>
                    <span
                      className={`mx-auto mt-1 block h-1 w-1 rounded-full ${
                        count > 0 ? "bg-moss" : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {dayBlocks.length === 0 ? (
              <EmptyDay onAdd={() => setMode("new")} />
            ) : (
              <ul className="space-y-2">
                {dayBlocks.map((block) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    isNow={activeBlock?.id === block.id && selectedDay === now?.getDay()}
                    canStart={!active}
                    onStart={() =>
                      startSession({
                        title: block.title,
                        course: block.course,
                        blockId: block.id,
                        plannedMinutes: block.endMin - block.startMin,
                      })
                    }
                    onEdit={() => setMode({ editing: block.id })}
                    onDelete={() => removeBlock(block.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function EmptyDay({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="text-sm text-muted">Nothing scheduled this day.</p>
      <button
        onClick={onAdd}
        className="mt-2 text-sm font-semibold text-moss hover:underline"
      >
        Add a study block
      </button>
    </div>
  );
}

interface RowProps {
  block: StudyBlock;
  isNow: boolean;
  canStart: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function BlockRow({ block, isNow, canStart, onStart, onEdit, onDelete }: RowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      className={`group rounded-xl border px-4 py-3 transition-colors ${
        isNow ? "border-moss/50 bg-moss/5" : "border-line-soft bg-surface-2/50 hover:border-line"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="tabular w-[4.75rem] shrink-0 text-xs leading-tight text-muted">
          <div className="font-medium text-ink">{formatClock(block.startMin)}</div>
          <div>{formatClock(block.endMin)}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{block.title}</span>
            {isNow && (
              <span className="shrink-0 rounded-full bg-moss px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas">
                Now
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-faint">
            <span className="truncate">{block.course}</span>
            {block.source === "canvas" && (
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-px text-[10px] font-semibold text-muted">
                Canvas
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <IconButton label="Edit block" onClick={onEdit}>
            ✎
          </IconButton>
          <IconButton
            label={confirming ? "Confirm delete" : "Delete block"}
            danger={confirming}
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? "!" : "×"}
          </IconButton>
        </div>

        <Button size="sm" variant="outline" onClick={onStart} disabled={!canStart}>
          Start
        </Button>
      </div>
    </li>
  );
}

function IconButton({
  children,
  label,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`h-7 w-7 rounded-lg text-sm transition-colors ${
        danger ? "bg-clay/15 text-clay" : "text-faint hover:bg-surface-2 hover:text-ink"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
