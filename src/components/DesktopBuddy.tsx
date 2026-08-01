"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
    };
  }
}

const WALK_SPEED = 1.4; // px per animation frame
const DUCK_SIZE = 96;

/**
 * "Let the duck out" toggles a desktop overlay. When the dashboard is running
 * inside the Electron shell (electron/main.js), it asks the main process to
 * open/close the real, borderless, click-through overlay window. In a plain
 * browser tab (no Electron), it falls back to a Document Picture-in-Picture
 * window — Chrome/Edge only, and bordered, but needs no native shell.
 */
export function DesktopBuddy() {
  const [isElectron, setIsElectron] = useState(false);
  const [electronOverlayOpen, setElectronOverlayOpen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const frameRef = useRef<number>(0);

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

  useEffect(() => {
    if (!pipWindow) return;
    const win = pipWindow;

    function tick() {
      const el = imgRef.current;
      if (el) {
        const maxX = win.innerWidth - DUCK_SIZE;
        posRef.current += WALK_SPEED * dirRef.current;
        if (posRef.current <= 0) {
          posRef.current = 0;
          dirRef.current = 1;
        } else if (posRef.current >= maxX) {
          posRef.current = maxX;
          dirRef.current = -1;
        }
        el.style.transform = `translateX(${posRef.current}px) scaleX(${dirRef.current})`;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [pipWindow]);

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
        {isOpen ? "Bring your buddy back" : "Let your buddy out"}
      </button>
      {!isElectron &&
        pipWindow &&
        createPortal(
          <img
            ref={imgRef}
            src="/placeholder.png"
            alt="Desktop buddy"
            style={{
              position: "absolute",
              bottom: 8,
              left: 0,
              width: DUCK_SIZE,
              height: DUCK_SIZE,
              objectFit: "contain",
              willChange: "transform",
            }}
          />,
          pipWindow.document.body,
        )}
    </>
  );
}
