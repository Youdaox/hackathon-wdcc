"use client";

import { useEffect, useRef, useState } from "react";
import type { StatusState } from "@/app/status/page";
import { createPortal } from "react-dom";
import { useWander } from "@/hooks/useWander";
import { useIncline } from "@/lib/store";
import { moodFor } from "@/lib/companion";
import { Pig } from "@/components/Pig";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
    electronAPI?: {
      isElectron: boolean;
      toggleOverlay: () => Promise<boolean>;
      setBackgroundTracking: (active: boolean) => void;
    };
    statusAPI?: {
      ready: () => void;
      /**
       * Subscribes to overlay status pushes. Declared here to match what
       * electron/preload.js actually exposes — the declaration listed only
       * `ready`, so every call to this failed to type check.
       */
      onUpdate: (handler: (state: StatusState) => void) => () => void;
    };
  }
}

const PET_SIZE = 96;

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

  useEffect(() => {
    setIsElectron(Boolean(window.electronAPI?.isElectron));
    setPipSupported("documentPictureInPicture" in window);
  }, []);

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
    undefined,
    // The Pig sprite's box-shadow pixel art is too expensive to rescale every
    // frame — see useWander's enableSquish doc comment.
    false,
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
          </div>,
          pipWindow.document.body,
        )}
    </>
  );
}
