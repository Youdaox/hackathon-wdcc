"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useIncline } from "@/lib/store";
import type { GradeResult, RecallQuestion } from "./ai";
import type { StudyMemoryDesktopPhase } from "@/lib/backgroundStatus";

const CAPTURE_INTERVAL_MS = 45_000;
const SETTINGS_KEY = "incline.studyMemory.v1";
const SENSITIVE_TITLE = /password|1password|bitwarden|bank|wallet|login|sign in|messages?|mail|health/i;

type Source = { id: string; name: string };
type CaptureState = StudyMemoryDesktopPhase;
type CaptureReason = "automatic" | "manual";

interface StudyMemoryContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  sources: Source[];
  sourceId: string;
  setSourceId: (id: string) => void;
  state: CaptureState;
  captures: number;
  pause: () => void;
  resume: () => void;
  available: boolean;
}

const StudyMemoryContext = createContext<StudyMemoryContextValue | null>(null);

export function StudyMemoryProvider({ children }: { children: React.ReactNode }) {
  const { active, outcome, awardRecallXp } = useIncline();
  const [enabled, setEnabledState] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceIdState] = useState("");
  const [state, setState] = useState<CaptureState>("off");
  const [captures, setCaptures] = useState(0);
  const [check, setCheck] = useState<{ checkId: string; sessionId: string; questions: RecallQuestion[] } | null>(null);
  const [error, setError] = useState("");
  const paused = useRef(false);
  const finalizedFor = useRef<string | null>(null);
  const capturedFor = useRef<string | null>(null);
  const captureInFlight = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const activeId = active?.id ?? null;
  const activeTitle = active?.title ?? "";
  const activeCourse = active?.course ?? "";

  /* localStorage and Electron sources exist only after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const value = JSON.parse(saved) as { enabled?: boolean; sourceId?: string };
        setEnabledState(value.enabled === true);
        setSourceIdState(value.sourceId ?? "");
      } catch { /* ignore stale settings */ }
    }
    void window.electronAPI?.studyMemory.getSources().then((items) => {
      setSources(items);
      setSourceIdState((current) => current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? ""));
    });
  }, []);

  const persist = useCallback((nextEnabled: boolean, nextSourceId: string) => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled: nextEnabled, sourceId: nextSourceId }));
  }, []);
  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next); persist(next, sourceId);
  }, [persist, sourceId]);
  const setSourceId = useCallback((next: string) => {
    setSourceIdState(next); persist(enabled, next);
  }, [enabled, persist]);

  const settleStatus = useCallback((phase: CaptureState, delay = 2_000) => {
    setState(phase);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(
      () => setState(paused.current ? "paused" : "ready"),
      delay,
    );
  }, []);

  const capture = useCallback(async (reason: CaptureReason) => {
    if (!activeId || !enabled || !sourceId || !window.electronAPI) return;
    if (reason === "automatic" && paused.current) return;
    if (captureInFlight.current) return;
    const selected = sources.find((source) => source.id === sourceId);
    if (!selected || SENSITIVE_TITLE.test(selected.name)) {
      settleStatus("excluded");
      return;
    }
    captureInFlight.current = true;
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setState("capturing");
    try {
      const shot = await window.electronAPI.studyMemory.capture(sourceId);
      if (!shot) { settleStatus("excluded"); return; }
      setState("processing");
      const response = await fetch("/api/study-memory/observations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusSessionId: activeId, title: activeTitle, course: activeCourse,
          sourceName: shot.sourceName, imageDataUrl: `data:image/jpeg;base64,${shot.imageDataUrl}`,
        }),
      });
      const result = await response.json().catch(() => ({})) as { accepted?: boolean; reason?: string };
      if (!response.ok) { settleStatus("error", 3_000); return; }
      if (result.accepted) {
        setCaptures((count) => count + 1);
        settleStatus("accepted");
      } else if (result.reason === "duplicate") {
        settleStatus("duplicate");
      } else {
        settleStatus("excluded");
      }
    } catch {
      settleStatus("error", 3_000);
    } finally {
      captureInFlight.current = false;
    }
  }, [activeId, activeTitle, activeCourse, enabled, sourceId, sources, settleStatus]);

  useEffect(() => {
    if (!activeId || !enabled || !sourceId || !window.electronAPI) {
      if (!activeId) setState("off");
      return;
    }
    capturedFor.current = activeId;
    paused.current = false;
    setCaptures(0);
    setState("ready");
    const initial = window.setTimeout(() => void capture("automatic"), 1_500);
    const interval = window.setInterval(() => void capture("automatic"), CAPTURE_INTERVAL_MS);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [activeId, enabled, sourceId, capture]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => window.electronAPI?.studyMemory.onManualCapture(
    () => void capture("manual"),
  ), [capture]);

  useEffect(() => {
    const bridge = window.electronAPI?.studyMemory;
    if (!bridge) return;
    const selected = sources.find((source) => source.id === sourceId);
    bridge.setStatus({
      enabled: Boolean(activeId && enabled),
      automaticPaused: paused.current,
      phase: activeId && enabled ? state : "off",
      acceptedCaptures: captures,
      sourceName: selected?.name ?? null,
      message: null,
    });
  }, [activeId, enabled, state, captures, sourceId, sources]);

  useEffect(() => () => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    window.electronAPI?.studyMemory.setStatus({
      enabled: false, automaticPaused: false, phase: "off", acceptedCaptures: 0,
      sourceName: null, message: null,
    });
  }, []);

  useEffect(() => {
    const session = outcome?.session;
    if (!session || capturedFor.current !== session.id || finalizedFor.current === session.id) return;
    finalizedFor.current = session.id;
    setState("processing");
    void fetch("/api/study-memory/finalize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusSessionId: session.id }),
    }).then(async (response) => {
      const payload = await response.json() as { checkId?: string; questions?: RecallQuestion[]; error?: string };
      if (!response.ok || !payload.checkId || !payload.questions) throw new Error(payload.error ?? "Could not build recall check");
      setCheck({ checkId: payload.checkId, sessionId: session.id, questions: payload.questions });
      setState("ready");
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : "Study Memory failed"); setState("error"); });
  }, [outcome]);

  const value = useMemo(() => ({
    enabled, setEnabled, sources, sourceId, setSourceId, state, captures,
    available: typeof window !== "undefined" && Boolean(window.electronAPI),
    pause: () => { paused.current = true; setState("paused"); },
    resume: () => { paused.current = false; setState(active ? "capturing" : "off"); },
  }), [enabled, setEnabled, sources, sourceId, setSourceId, state, captures, active]);

  return <StudyMemoryContext.Provider value={value}>
    {children}
    {check && <RecallDialog check={check} onClose={() => setCheck(null)} onAward={(xp) => awardRecallXp(check.sessionId, xp)} />}
    {state === "error" && error && <div className="fixed bottom-5 left-1/2 z-60 -translate-x-1/2 rounded-xl border border-amber/40 bg-surface px-4 py-3 text-sm text-amber shadow-xl">{error}</div>}
  </StudyMemoryContext.Provider>;
}

export function useStudyMemory() {
  const value = useContext(StudyMemoryContext);
  if (!value) throw new Error("useStudyMemory must be used inside StudyMemoryProvider");
  return value;
}

function RecallDialog({ check, onClose, onAward }: {
  check: { checkId: string; questions: RecallQuestion[] };
  onClose: () => void; onAward: (xp: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; xpAwarded: number; results: GradeResult[] } | null>(null);
  const [error, setError] = useState("");
  const submit = async () => {
    setSubmitting(true); setError("");
    const response = await fetch("/api/study-memory/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkId: check.checkId, answers }),
    });
    const payload = await response.json() as typeof result & { error?: string };
    setSubmitting(false);
    if (!response.ok || !payload) { setError(payload?.error ?? "Could not grade answers"); return; }
    setResult(payload); onAward(payload.xpAwarded);
  };
  return <div className="fixed inset-0 z-70 overflow-y-auto bg-canvas/90 p-4 backdrop-blur-sm">
    <div className="card mx-auto my-8 w-full max-w-2xl p-7 shadow-2xl">
      <div className="eyebrow text-citrus">AI Study Memory</div>
      <h2 className="mt-2 text-2xl font-extrabold">What stuck?</h2>
      {!result ? <>
        <p className="mt-2 text-sm text-muted">Answer in your own words. These questions are grounded in what was visible during your session.</p>
        <div className="mt-6 space-y-6">{check.questions.map((question, index) => <label key={question.id} className="block">
          <span className="text-sm font-bold">{index + 1}. {question.question}</span>
          <textarea value={answers[question.id] ?? ""} onChange={(event) => setAnswers((all) => ({ ...all, [question.id]: event.target.value }))}
            className="mt-2 min-h-28 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm outline-none focus:border-moss" placeholder="Explain it as if you were teaching someone else…" />
        </label>)}</div>
        {error && <p className="mt-4 text-sm text-clay">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-faint">Skip</button><button disabled={submitting} onClick={() => void submit()} className="rounded-xl bg-moss px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? "Grading…" : "Check my recall"}</button></div>
      </> : <>
        <div className="mt-6 rounded-2xl bg-moss/10 p-5"><div className="text-4xl font-extrabold text-moss">{result.score}%</div><div className="mt-1 text-sm font-semibold">Understanding score · +{result.xpAwarded} recall XP</div></div>
        <div className="mt-5 space-y-4">{result.results.map((grade, index) => <div key={index} className="rounded-xl bg-surface-2 p-4"><div className="text-sm font-bold">Question {index + 1}</div><p className="mt-1 text-sm text-muted">{grade.feedback}</p>{grade.missingPoints.length > 0 && <p className="mt-2 text-xs text-amber">Review: {grade.missingPoints.join(" · ")}</p>}</div>)}</div>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-moss px-5 py-3 text-sm font-bold text-white">Back to dashboard</button>
      </>}
    </div>
  </div>;
}
