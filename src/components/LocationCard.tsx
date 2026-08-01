"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useIncline } from "@/lib/store";
import { BONUS_ZONES, formatDistance } from "@/lib/zones";

/**
 * Location is a bonus, never a gate. Every failure path here still leaves a
 * fully working app at 1× — the card just explains what's happening.
 */
export function LocationCard() {
  const { geoEnabled, setGeoEnabled, geoStatus, geoReading, currentZone, nearest } = useIncline();
  const [showZones, setShowZones] = useState(false);

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Study spots</h2>
          <p className="mt-0.5 text-sm text-muted">Focus on campus, earn more XP.</p>
        </div>
        {currentZone && (
          <span className="tabular shrink-0 rounded-full bg-citrus/15 px-3 py-1.5 text-sm font-bold text-citrus">
            {currentZone.multiplier}× active
          </span>
        )}
      </div>

      <div className="mt-4">
        {!geoEnabled ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center">
            <p className="text-sm text-muted">
              Turn on location to earn up to 1.5× XP at campus study spots.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setGeoEnabled(true)}>
              Enable location bonus
            </Button>
          </div>
        ) : (
          <StatusBody
            status={geoStatus}
            zoneName={currentZone?.name}
            nearestName={nearest?.zone.name}
            nearestDistance={nearest ? formatDistance(nearest.distanceM) : null}
            accuracyM={geoReading?.accuracyM ?? null}
            onDisable={() => setGeoEnabled(false)}
          />
        )}
      </div>

      <button
        onClick={() => setShowZones((v) => !v)}
        className="mt-4 text-xs font-semibold text-faint transition-colors hover:text-muted"
      >
        {showZones ? "Hide" : "See"} the {BONUS_ZONES.length} bonus zones
      </button>

      {showZones && (
        <ul className="animate-rise mt-3 space-y-2 border-t border-line-soft pt-3">
          {BONUS_ZONES.map((zone) => (
            <li key={zone.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{zone.name}</div>
                <div className="truncate text-xs text-faint">{zone.blurb}</div>
              </div>
              <span
                className={`tabular shrink-0 text-sm font-bold ${
                  currentZone?.id === zone.id ? "text-citrus" : "text-faint"
                }`}
              >
                {zone.multiplier}×
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Handy for recalibrating zone coordinates on site. */}
      {geoReading && (
        <p className="tabular mt-3 text-[11px] text-faint">
          You: {geoReading.lat.toFixed(5)}, {geoReading.lng.toFixed(5)}
        </p>
      )}
    </section>
  );
}

interface StatusProps {
  status: string;
  zoneName?: string;
  nearestName?: string;
  nearestDistance: string | null;
  accuracyM: number | null;
  onDisable: () => void;
}

function StatusBody({
  status,
  zoneName,
  nearestName,
  nearestDistance,
  accuracyM,
  onDisable,
}: StatusProps) {
  if (status === "denied") {
    return (
      <Notice tone="muted">
        Location permission was declined — no problem. Sessions still count in full at 1× XP. Re-allow
        it in your browser&apos;s site settings if you change your mind.
      </Notice>
    );
  }

  if (status === "unsupported") {
    return (
      <Notice tone="muted">
        This browser doesn&apos;t support geolocation. Everything else works normally at 1× XP.
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <Notice tone="warn">
        Couldn&apos;t get a fix right now — still trying. Sessions count at 1× until one lands.
      </Notice>
    );
  }

  if (status === "locating") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-4">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber" />
        <span className="text-sm text-muted">Finding you…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-2/60 px-4 py-4">
      {zoneName ? (
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-citrus" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-citrus">In {zoneName}</div>
            <div className="text-xs text-muted">Bonus applies when this session ends.</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-faint" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Outside every bonus zone</div>
            <div className="truncate text-xs text-muted">
              {nearestName && nearestDistance
                ? `${nearestDistance} from ${nearestName} · sessions count at 1×`
                : "Sessions count at 1×"}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3">
        <span className="tabular text-[11px] text-faint">
          {accuracyM !== null ? `±${Math.round(accuracyM)}m accuracy` : "Locating…"}
        </span>
        <button
          onClick={onDisable}
          className="text-[11px] font-semibold text-faint transition-colors hover:text-muted"
        >
          Turn off
        </button>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "muted" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-xl px-4 py-4 text-sm ${
        tone === "warn" ? "bg-amber/10 text-amber" : "bg-surface-2/60 text-muted"
      }`}
    >
      {children}
    </p>
  );
}
