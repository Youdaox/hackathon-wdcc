"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    overlayAPI?: {
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
    };
  }
}

const WALK_SPEED = 1.4; // px per animation frame
const DUCK_SIZE = 96;

/**
 * Full-viewport, transparent-background page meant to be loaded only by the Electron
 * overlay shell (see electron/main.js) — not part of the normal dashboard flow.
 */
export default function OverlayPage() {
  const imgRef = useRef<HTMLImageElement>(null);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const frameRef = useRef<number>(0);

  // The dashboard layout paints an opaque background; undo that here so the
  // Electron window's transparency shows through.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";
    return () => {
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
    };
  }, []);

  useEffect(() => {
    function tick() {
      const el = imgRef.current;
      if (el) {
        const maxX = window.innerWidth - DUCK_SIZE;
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
  }, []);

  // Hit-testing: the Electron window ignores the mouse by default (click-through
  // to whatever's underneath). We forward mousemove events into this page, check
  // whether the cursor is over the duck, and toggle ignoreMouseEvents accordingly.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const overDuck = el?.id === "duck";
      window.overlayAPI?.setIgnoreMouseEvents(!overDuck, { forward: true });
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent" }}>
      <img
        id="duck"
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
          cursor: "pointer",
        }}
      />
    </div>
  );
}
