"use client";

import { useEffect, useRef, type RefObject } from "react";

const SPEED = 0.8; // px per animation frame
const MIN_IDLE_MS = 2500;
const MAX_IDLE_MS = 6000;
const MIN_WALK_MS = 1500;
const MAX_WALK_MS = 4000;
const IDLE_SQUISH_PERIOD_MS = 900;
const IDLE_SQUISH_AMOUNT = 0.14;
const WALK_STEP_MS = 260; // one hop (ground → peak → ground)
const WALK_BOB_HEIGHT = 5; // px lift at the peak of each hop
const WALK_SQUISH_AMOUNT = 0.05; // squash on ground contact

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Drives a wandering sprite: alternates between idle pauses (with a squash
 * "breathing" bounce) and walks in a random direction, bouncing off the edges
 * of `getBounds()`. Also click-and-draggable — pointerdown on the element
 * takes over its position until pointerup, then it resumes wandering from
 * wherever it was dropped. Writes position/facing/squish straight to
 * `elRef.current.style.transform` every frame.
 *
 * `onDragStateChange` lets a caller with its own hit-testing (e.g. the
 * Electron overlay, which otherwise re-evaluates hover on every mousemove)
 * suppress that logic while a drag is in progress — pointer capture keeps
 * events routed to the element even once the cursor leaves its bounds.
 */
export function useWander(
  elRef: RefObject<HTMLElement | null>,
  size: number,
  active: boolean,
  getBounds: () => { width: number; height: number },
  onDragStateChange?: (dragging: boolean) => void,
) {
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const facingRef = useRef(1);
  const modeRef = useRef<"idle" | "walking">("idle");
  const modeUntilRef = useRef(0);
  const idleStartRef = useRef(0);
  const walkStartRef = useRef(0);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const getBoundsRef = useRef(getBounds);
  getBoundsRef.current = getBounds;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  useEffect(() => {
    if (!active) return;
    const target = elRef.current;
    if (!target) return;
    const el = target;

    function enterIdle(now: number) {
      modeRef.current = "idle";
      velRef.current = { x: 0, y: 0 };
      idleStartRef.current = now;
      modeUntilRef.current = now + randRange(MIN_IDLE_MS, MAX_IDLE_MS);
    }

    function enterWalk(now: number) {
      const angle = Math.random() * Math.PI * 2;
      velRef.current = { x: Math.cos(angle) * SPEED, y: Math.sin(angle) * SPEED };
      modeRef.current = "walking";
      walkStartRef.current = now;
      modeUntilRef.current = now + randRange(MIN_WALK_MS, MAX_WALK_MS);
    }

    // Start idle briefly so the buddy doesn't immediately bolt the moment it appears.
    enterIdle(performance.now());
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    // Anchor squash/stretch to the bottom edge so idle squish reads as
    // sinking toward the ground, not compressing symmetrically from the center.
    el.style.transformOrigin = "bottom center";

    function handlePointerDown(e: PointerEvent) {
      draggingRef.current = true;
      velRef.current = { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      onDragStateChangeRef.current?.(true);
    }

    function handlePointerMove(e: PointerEvent) {
      if (!draggingRef.current) return;
      const { width, height } = getBoundsRef.current();
      const maxX = Math.max(0, width - size);
      const maxY = Math.max(0, height - size);
      posRef.current = {
        x: clamp(e.clientX - dragOffsetRef.current.x, 0, maxX),
        y: clamp(e.clientY - dragOffsetRef.current.y, 0, maxY),
      };
    }

    function handlePointerUp(e: PointerEvent) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "grab";
      onDragStateChangeRef.current?.(false);
      enterIdle(performance.now());
    }

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handlePointerUp);

    function tick(now: number) {
      const el = elRef.current;
      if (el) {
        if (!draggingRef.current) {
          if (now >= modeUntilRef.current) {
            if (modeRef.current === "idle") enterWalk(now);
            else enterIdle(now);
          }

          const { width, height } = getBoundsRef.current();
          const maxX = Math.max(0, width - size);
          const maxY = Math.max(0, height - size);
          const vel = velRef.current;
          const pos = posRef.current;

          let nextX = pos.x + vel.x;
          let nextY = pos.y + vel.y;

          if (nextX < 0) {
            nextX = 0;
            vel.x *= -1;
          } else if (nextX > maxX) {
            nextX = maxX;
            vel.x *= -1;
          }
          if (nextY < 0) {
            nextY = 0;
            vel.y *= -1;
          } else if (nextY > maxY) {
            nextY = maxY;
            vel.y *= -1;
          }

          pos.x = nextX;
          pos.y = nextY;
          // The artwork's neutral pose faces left, so scaleX(1) reads as
          // "facing left" — moving right needs a mirror flip, not left.
          if (vel.x !== 0) facingRef.current = vel.x > 0 ? -1 : 1;
        }

        const pos = posRef.current;
        let squishY = 1;
        let bobY = 0;
        if (!draggingRef.current) {
          if (modeRef.current === "idle") {
            const elapsed = now - idleStartRef.current;
            const phase = (elapsed / IDLE_SQUISH_PERIOD_MS) * Math.PI * 2;
            squishY = 1 - Math.sin(phase) * IDLE_SQUISH_AMOUNT;
          } else {
            const elapsed = now - walkStartRef.current;
            const hop = Math.abs(Math.sin((elapsed / WALK_STEP_MS) * Math.PI));
            bobY = -hop * WALK_BOB_HEIGHT;
            squishY = 1 - (1 - hop) * WALK_SQUISH_AMOUNT;
          }
        }

        el.style.transform = `translate(${pos.x}px, ${pos.y + bobY}px) scaleX(${facingRef.current}) scaleY(${squishY})`;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameRef.current);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [active, elRef, size]);
}
