"use client";

import { useEffect, useState } from "react";

export type StatusState = {
  mode: "focused" | "unfocused" | "idle";
  label: string;
  tone: string;
};

export default function StatusPage() {
  const [state, setState] = useState<StatusState>({
    mode: "focused",
    label: "Focused",
    tone: "bg-moss",
  });

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.background = "transparent";
    body.style.background = "transparent";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const unsubscribe = window.statusAPI?.onUpdate((next) => setState(next));
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.statusAPI?.ready();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      unsubscribe?.();
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div className="h-full w-full overflow-hidden bg-transparent p-3">
      <div className="flex h-full items-center gap-2 rounded-full border border-white/10 bg-slate-950/85 px-4 py-3 text-sm text-ink shadow-lg backdrop-blur">
        <span className={`h-2.5 w-2.5 rounded-full ${state.tone}`} />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-faint">
            {state.mode === "focused"
              ? "Focused"
              : state.mode === "unfocused"
                ? "Unfocused"
                : "Tracking idle"}
          </div>
          <div className="text-sm font-semibold text-ink">{state.label}</div>
        </div>
      </div>
    </div>
  );
}