"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWander } from "@/hooks/useWander";
import { useIncline } from "@/lib/store";
import { moodFor } from "@/lib/companion";
import { Pig } from "@/components/Pig";
import { SpeechBubble } from "@/components/SpeechBubble";
import { randomIdleLine } from "@/lib/speechLines";

// Electron window bridges are declared once in `src/types/electron.d.ts`.
// Document Picture-in-Picture isn't in TypeScript's DOM lib yet, and this is
// the only file that uses it, so it's declared locally instead.
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

const PET_SIZE = 96;
const DRAG_SPEECH_LINE = "Let me down!";
const DRAG_SPEECH_DELAY_MS = 600;
const SPEECH_EVERY_N_IDLES = 3;
const SPEECH_DURATION_MS = 3000;  

/**
 * "Let the duck out" toggles a desktop overlay. When the dashboard is running
 * inside the Electron shell (electron/main.js), it asks the main process to
 * open/close the real, borderless, click-through overlay window. In a plain
 * browser tab (no Electron), it falls back to a Document Picture-in-Picture
 * window — Chrome/Edge only, and bordered, but needs no native shell.
 */
export function DesktopBuddy() {
  const { companion } = useIncline();
  const [isElectron, setIsElectron] = useState(false);
  const [electronOverlayOpen, setElectronOverlayOpen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const petRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const idleCountRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dragSpeechTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [bubbleText, setBubbleText] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(speechTimeoutRef.current);
      clearTimeout(dragSpeechTimeoutRef.current);
    };
  }, []);

  // Neither capability can be detected during render without breaking SSR —
  // the same reason `store.tsx` and `useFocusTracking.ts` carry this exemption.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsElectron(Boolean(window.electronAPI?.isElectron));
    setPipSupported("documentPictureInPicture" in window);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function openPip() {
    if (!window.documentPictureInPicture) return;
    const pip = await window.documentPictureInPicture.requestWindow({
      width: 240,
      height: 160,
    });

    pip.document.title = "Incline buddy";
    pip.document.body.style.margin = "0";
    pip.document.body.style.overflow = "hidden";
    pip.document.body.style.background = "transparent";
    pip.document.documentElement.style.background = "transparent";

    // The Pig component is styled entirely through the app's CSS classes, not
    // inline styles, so the popped-out window needs its own copy of the
    // stylesheet to render it correctly.
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const rules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
        const style = pip.document.createElement("style");
        style.textContent = rules;
        pip.document.head.appendChild(style);
      } catch {
        if (styleSheet.href) {
          const link = pip.document.createElement("link");
          link.rel = "stylesheet";
          link.href = styleSheet.href;
          pip.document.head.appendChild(link);
        }
      }
    });

    pip.addEventListener("pagehide", () => setPipWindow(null));
    setPipWindow(pip);
  }

  function closePip() {
    pipWindow?.close();
    setPipWindow(null);
  }

  async function toggle() {
    if (isElectron) {
      const open = await window.electronAPI!.toggleOverlay();
      setElectronOverlayOpen(open);
      return;
    }
    if (pipWindow) {
      closePip();
    } else {
      await openPip();
    }
  }

  useWander(
    petRef,
    PET_SIZE,
    Boolean(pipWindow),
    () => ({
      width: pipWindow?.innerWidth ?? 0,
      height: pipWindow?.innerHeight ?? 0,
    }),
    (dragging) => {
      clearTimeout(speechTimeoutRef.current);
      clearTimeout(dragSpeechTimeoutRef.current);
      setBubbleText(null);
      if (dragging) {
        dragSpeechTimeoutRef.current = setTimeout(() => setBubbleText(DRAG_SPEECH_LINE), DRAG_SPEECH_DELAY_MS);
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

  useEffect(() => {
    return () => {
      pipWindow?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isElectron && !pipSupported) return null;

  const isOpen = isElectron ? electronOverlayOpen : Boolean(pipWindow);

  return (
    <>
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 z-50 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted shadow-lg transition-colors hover:text-ink"
      >
        {isOpen ? "Bring your buddy back in" : "Let your buddy out"}
      </button>
      {!isElectron &&
        pipWindow &&
        createPortal(
          <>
            <div
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
          </>,
          pipWindow.document.body,
        )}
    </>
  );
}
