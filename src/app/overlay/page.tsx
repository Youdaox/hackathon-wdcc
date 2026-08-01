"use client";

import { useEffect, useRef } from "react";
import { useWander } from "@/hooks/useWander";
import { useIncline } from "@/lib/store";
import { moodFor } from "@/lib/companion";
import { Pig } from "@/components/Pig";

declare global {
  interface Window {
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      ready: () => void;
    };
  }
}

const PET_SIZE = 96;

/**
 * Full-viewport, transparent-background page meant to be loaded only by the Electron
 * overlay shell (see electron/main.js) — not part of the normal dashboard flow.
 */
export default function OverlayPage() {
  const { companion } = useIncline();
  const petRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // The dashboard layout paints an opaque background; undo that here so the
  // Electron window's transparency shows through.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";

    // Two frames guarantees the transparent style has actually been painted
    // before we tell Electron it's safe to reveal the window.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.overlayAPI?.ready();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, []);

  useWander(
    petRef,
    PET_SIZE,
    true,
    () => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }),
    (dragging) => {
      draggingRef.current = dragging;
      // Pointer capture keeps drag events routed to the pet even once the
      // cursor leaves its bounds — don't let hit-testing fight that by
      // click-through-ing the window mid-drag.
      if (dragging) window.overlayAPI?.setIgnoreMouseEvents(false);
    },
  );

  // Hit-testing: the Electron window ignores the mouse by default (click-through
  // to whatever's underneath). We forward mousemove events into this page, check
  // whether the cursor is over the pet, and toggle ignoreMouseEvents accordingly.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (draggingRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const overPet = Boolean(el?.closest("#pet"));
      window.overlayAPI?.setIgnoreMouseEvents(!overPet, { forward: true });
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent" }}>
      <div
        id="pet"
        ref={petRef}
        role="img"
        aria-label="Desktop buddy"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: PET_SIZE,
          height: PET_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          willChange: "transform",
          userSelect: "none",
        }}
      >
        <Pig
          mood={moodFor(companion.hp)}
          level={companion.level}
          color={companion.color}
          accessory={companion.accessory}
          hp={companion.hp}
          size={PET_SIZE}
        />
      </div>
    </div>
  );
}
