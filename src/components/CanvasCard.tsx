"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCanvas, type CanvasState } from "@/hooks/useCanvas";
import type { CanvasStudyBlock, CanvasUpcomingAssignment } from "@/lib/canvas/query";
import { DAY_LABELS, formatClock } from "@/lib/time";
import { NEW_ZEALAND_TIME_ZONE } from "@/lib/timezone";

/**
 * Canvas connection + timetable import.
 *
 * Login posts the token to the server, which verifies it against the instance
 * and keeps it in an httpOnly cookie — so this component never holds a
 * credential in state beyond the keystrokes in the form.
 */

const FIELD =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-moss focus:outline-none";

export function CanvasCard() {
  const canvas = useCanvas();

  return (
    <section className="card p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Canvas</h2>
          <p className="mt-0.5 text-sm text-muted">
            Pull your real timetable in instead of typing it out.
          </p>
        </div>
        {canvas.phase === "connected" && <SourceBadge canvas={canvas} />}
      </header>

      <div className="mt-5">
        {canvas.phase === "checking" && <div className="h-24 animate-pulse rounded-xl bg-surface-2" />}
        {canvas.phase === "disconnected" && <LoginForm canvas={canvas} />}
        {canvas.phase === "connected" && <Connected canvas={canvas} />}
      </div>
    </section>
  );
}

/** Says plainly whether what's on screen is real or fixture data. */
function SourceBadge({ canvas }: { canvas: CanvasState }) {
  const demo = canvas.overview?.dataSource === "mock";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        demo ? "bg-amber/15 text-amber" : "bg-moss/15 text-moss"
      }`}
    >
      {demo ? "Demo data" : "Live"}
    </span>
  );
}

function LoginForm({ canvas }: { canvas: CanvasState }) {
  const [instance, setInstance] = useState("canvas.auckland.ac.nz");
  const [token, setToken] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void canvas.connect(instance, token);
      }}
    >
      <label className="block">
        <span className="eyebrow mb-1.5 block">Canvas URL</span>
        <input
          className={FIELD}
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
          placeholder="canvas.auckland.ac.nz"
          autoComplete="url"
        />
      </label>

      <label className="block">
        <span className="eyebrow mb-1.5 block">Access token</span>
        <input
          className={FIELD}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="1234~abcdef…"
          autoComplete="off"
        />
      </label>

      <details className="rounded-xl border border-line-soft bg-surface-2/40 px-3 py-2.5 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-ink">
          Where do I get a token?
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 leading-relaxed">
          <li>In Canvas, open <strong>Account → Settings</strong>.</li>
          <li>Under Approved Integrations, press <strong>+ New Access Token</strong>.</li>
          <li>Name it &ldquo;Incline&rdquo;, leave the expiry blank, and generate.</li>
          <li>Copy the token — Canvas only shows it once.</li>
        </ol>
        <p className="mt-2 leading-relaxed">
          The token is verified, then stored in an httpOnly cookie on this server. It is never
          readable by page scripts, and it is gone when you disconnect or close the browser.
        </p>
      </details>

      {canvas.loginError && <p className="text-sm text-clay">{canvas.loginError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={canvas.loggingIn}>
          {canvas.loggingIn ? "Connecting…" : "Connect Canvas"}
        </Button>
        <button
          type="button"
          onClick={() => void canvas.previewDemo()}
          className="text-xs font-semibold text-faint hover:text-muted"
        >
          or explore with demo data
        </button>
      </div>
    </form>
  );
}

function Connected({ canvas }: { canvas: CanvasState }) {
  const { overview } = canvas;
  const blocks = overview?.studyBlocks ?? [];

  return (
    <div className="animate-rise space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {canvas.user?.name ?? (overview?.dataSource === "mock" ? "Demo student" : "Connected")}
          </p>
          <p className="truncate text-xs text-faint">
            {canvas.origin === "env"
              ? "Using this deployment's Canvas account"
              : (canvas.baseUrl?.replace(/^https?:\/\//, "") ??
                "Sample timetable — nothing is connected")}
          </p>
        </div>
        <button
          onClick={() => void canvas.disconnect()}
          className="shrink-0 text-xs font-semibold text-faint hover:text-clay"
        >
          {canvas.origin === "session" ? "Disconnect" : "Close"}
        </button>
      </div>

      {overview && overview.courses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {overview.courses.map((course) => (
            <span
              key={course.id}
              title={course.name}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted"
            >
              {course.courseCode}
            </span>
          ))}
        </div>
      )}

      {canvas.error && <p className="text-sm text-clay">{canvas.error}</p>}

      {canvas.loadingOverview ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <>
          <TimetablePreview blocks={blocks} />
          <UpcomingWork assignments={overview?.assignments ?? []} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        <Button onClick={canvas.importTimetable} disabled={blocks.length === 0}>
          {blocks.length > 0 ? `Import ${blocks.length} blocks` : "Nothing to import"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => void canvas.refresh()}>
          Refresh
        </Button>
        {canvas.lastImport && <ImportSummary result={canvas.lastImport} />}
      </div>
    </div>
  );
}

/** Re-import is safe, so the result has to say whether anything actually moved. */
function ImportSummary({ result }: { result: { added: number; updated: number } }) {
  const parts: string[] = [];
  if (result.added) parts.push(`${result.added} added`);
  if (result.updated) parts.push(`${result.updated} updated`);

  return (
    <span className="text-xs font-semibold text-moss">
      {parts.length > 0 ? parts.join(", ") : "Already up to date"}
    </span>
  );
}

function TimetablePreview({ blocks }: { blocks: CanvasStudyBlock[] }) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        No timetabled classes found this week.
      </p>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-2">This week&rsquo;s classes</p>
      <ul className="space-y-1.5">
        {blocks.map((block) => (
          <li
            key={block.externalId}
            className="flex items-center gap-3 rounded-lg bg-surface-2/50 px-3 py-2"
          >
            <span className="tabular w-24 shrink-0 text-xs text-muted">
              {formatClock(block.startMin)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{block.title}</span>
            <span className="shrink-0 text-[11px] font-semibold text-faint">
              {block.days.map((day) => DAY_LABELS[day][0]).join("")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpcomingWork({ assignments }: { assignments: CanvasUpcomingAssignment[] }) {
  if (assignments.length === 0) return null;

  return (
    <div>
      <p className="eyebrow mb-2">Due soon</p>
      <ul className="space-y-1.5">
        {assignments.map((assignment) => (
          <li key={assignment.id} className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">
              <a
                href={assignment.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-moss hover:underline"
              >
                {assignment.name}
              </a>
            </span>
            <span className="shrink-0 text-xs text-faint">{dueLabel(assignment.dueAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "in 3 days" reads better than a date when everything is within a fortnight. */
function dueLabel(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const days = Math.round((Date.parse(dueAt) - Date.now()) / 86_400_000);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `in ${days} days`;
  return new Date(dueAt).toLocaleDateString("en-NZ", { timeZone: NEW_ZEALAND_TIME_ZONE, day: "numeric", month: "short" });
}
