"use client";

import { useEffect, useRef, useState } from "react";
import { useWander } from "@/hooks/useWander";
import { useIncline } from "@/lib/store";
import { moodFor } from "@/lib/companion";
import { Pig } from "@/components/Pig";
import { SpeechBubble } from "@/components/SpeechBubble";
import { randomIdleLine } from "@/lib/speechLines";

declare global {
  interface Window {
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      ready: () => void;
      onDiscordTarget: (handler: (position: { x: number; y: number }) => void) => () => void;
      onDiscordBlurred: (handler: () => void) => () => void;
      discordReached: () => void;
    };
  }
}

const PET_SIZE = 96;
const DRAG_SPEECH_LINE = "Let me down!";
const DRAG_SPEECH_DELAY_MS = 600;
const LOCK_IN_LINE = "LOCK IN";
const LOCK_IN_WINDUP_MS = 800;
const SPEECH_EVERY_N_IDLES = 3;
const SPEECH_DURATION_MS = 3000;

/**
 * Full-viewport, transparent-background page meant to be loaded only by the Electron
 * overlay shell (see electron/main.js) — not part of the normal dashboard flow.
 */
export default function OverlayPage() {
  const { companion } = useIncline();
  const petRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const idleCountRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockInTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [bubbleText, setBubbleText] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(speechTimeoutRef.current);
      clearTimeout(dragSpeechTimeoutRef.current);
      clearTimeout(lockInTimeoutRef.current);
    };
  }, []);

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

  const { goTo, cancel } = useWander(
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
      clearTimeout(speechTimeoutRef.current);
      clearTimeout(dragSpeechTimeoutRef.current);
      if (dragging) {
        setBubbleText(null);
        dragSpeechTimeoutRef.current = setTimeout(() => setBubbleText(DRAG_SPEECH_LINE), DRAG_SPEECH_DELAY_MS);
      } else {
        setBubbleText(null);
      }
    },
    // The Pig sprite's box-shadow pixel art is too expensive to rescale every
    // frame — see useWander's enableSquish doc comment.
    false,
    () => {
      idleCountRef.current += 1;
      if (idleCountRef.current % SPEECH_EVERY_N_IDLES !== 0) return;
      setBubbleText(randomIdleLine());
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = setTimeout(() => setBubbleText(null), SPEECH_DURATION_MS);
    },
    bubbleRef,
  );

  // The main process watches for Discord becoming the focused app and sends
  // its close button's screen position — wind up (shake + "LOCK IN"), then
  // walk the pet's center there, then let main run the actual quit once it
  // arrives (see electron/closeApp.js).
  useEffect(() => {
    return window.overlayAPI?.onDiscordTarget((position) => {
      clearTimeout(speechTimeoutRef.current);
      clearTimeout(dragSpeechTimeoutRef.current);
      clearTimeout(lockInTimeoutRef.current);
      setBubbleText(LOCK_IN_LINE);
      lockInTimeoutRef.current = setTimeout(() => setBubbleText(null), LOCK_IN_WINDUP_MS);
      goTo(
        position.x - PET_SIZE / 2,
        position.y - PET_SIZE / 2,
        () => window.overlayAPI?.discordReached(),
        LOCK_IN_WINDUP_MS,
      );
    });
  }, [goTo]);

  // Tabbed away before the pet reached it — call off the whole pursuit and
  // drop straight back to normal idle/wandering, without closing anything.
  useEffect(() => {
    return window.overlayAPI?.onDiscordBlurred(() => {
      clearTimeout(lockInTimeoutRef.current);
      setBubbleText(null);
      cancel();
    });
  }, [cancel]);

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
      {bubbleText && (
        <SpeechBubble ref={bubbleRef} size={PET_SIZE}>
          {bubbleText}
        </SpeechBubble>
      )}
    </div>
  );
}
