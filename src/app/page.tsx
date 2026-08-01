"use client";

import { useState } from "react";
import { CanvasCard } from "@/components/CanvasCard";
import { CameraOverlay, FocusPanel } from "@/components/FocusPanel";
import { CompanionCard } from "@/components/CompanionCard";
import { LocationCard } from "@/components/LocationCard";
import { RecallCheck } from "@/components/RecallCheck";
import { SchedulePanel } from "@/components/SchedulePanel";
import { SessionSummary } from "@/components/SessionSummary";
import { TodaySummary } from "@/components/TodaySummary";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useIncline } from "@/lib/store";

export default function Dashboard() {
  const { hydrated, active, eyeEnabled } = useIncline();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Incline
            <span className="ml-1 text-moss">.</span>
          </h1>
          <p className="hidden text-sm text-faint sm:block">
            Your companion grows on verified focus only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InstallAppButton />
          <ThemeToggle />
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? "border-moss/40 bg-moss/10 text-moss" : "border-line bg-surface text-faint"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? "animate-pulse bg-moss" : "bg-faint"}`}
            />
            {active ? "Session running" : "Idle"}
          </div>
        </div>
      </header>

      {!hydrated ? (
        <LoadingState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-6">
            <FocusPanel />
            <SchedulePanel />
            <CanvasCard />
          </div>
          <div className="space-y-6">
            <CompanionCard />
            <TodaySummary />
            <LocationCard />
          </div>
        </div>
      )}

      <Footer />
      <RecallCheck />
      <SessionSummary />
      {eyeEnabled && active && <CameraOverlay />}
    </main>
  );
}

/** Reset lives here so a demo run can be started from scratch on the spot. */
function Footer() {
  const { resetEverything } = useIncline();
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="mt-10 flex items-center justify-between border-t border-line-soft pt-5 text-xs text-faint">
      <span>
        Focus is verified with the Page Visibility API, and with your webcam if you turn eye tracking
        on. Everything — video included — stays on your device.
      </span>
      <button
        onClick={() => (confirming ? resetEverything() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        className={`rounded-full px-3 py-1 font-semibold transition-colors ${
          confirming ? "bg-clay/15 text-clay" : "hover:text-muted"
        }`}
      >
        {confirming ? "Erase everything — sure?" : "Reset demo data"}
      </button>
    </footer>
  );
}

/** Placeholder while localStorage is read — avoids a hydration mismatch. */
function LoadingState() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      <div className="space-y-6">
        <div className="card h-72 animate-pulse" />
        <div className="card h-80 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
      <div className="space-y-6">
        <div className="card h-96 animate-pulse" />
        <div className="card h-40 animate-pulse" />
      </div>
    </div>
  );
}
