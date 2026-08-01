import { forwardRef } from "react";

/**
 * A small speech bubble that follows the pet — used by the desktop pet
 * overlay. Position isn't a prop: `useWander` writes `translate(x, y)`
 * straight to this element's ref every frame (same as the pet itself), so
 * the bubble tracks it exactly, including mid-drag, without React re-renders.
 */
export const SpeechBubble = forwardRef<HTMLDivElement, { size: number; children: React.ReactNode }>(
  function SpeechBubble({ size, children }, ref) {
    return (
      <div ref={ref} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {/* This inner wrapper owns the constant "centered above the pet" offset
            and must never get an animation on `transform` — a CSS animation on
            that property fully replaces any inline transform, including this. */}
        <div
          style={{
            transform: `translate(calc(${size / 2}px - 50%), calc(-100% - 14px))`,
            imageRendering: "pixelated",
          }}
        >
          <div className="animate-rise relative whitespace-nowrap rounded-none border-2 border-line bg-surface px-3 py-2 font-mono text-xs font-semibold text-ink shadow-lg">
            {children}
            {/* Pixel-staircase tail, centered under the bubble — which is itself
                centered above the pet — so it always points straight at it. */}
            <div className="absolute left-1/2 top-full -translate-x-1/2">
              <div className="mx-auto h-1 w-4 border-x-2 border-b-2 border-line bg-surface" />
              <div className="mx-auto h-1 w-2 border-x-2 border-b-2 border-line bg-surface" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);
