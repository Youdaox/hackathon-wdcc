"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

const SPEED = 0.8; // px per animation frame
const GOTO_SPEED = 2.5; // faster than idle wandering — this is a deliberate errand
const ARRIVE_DISTANCE = GOTO_SPEED; // close enough to snap to the target and stop
const MIN_IDLE_MS = 4000;
const MAX_IDLE_MS = 9000;
const MIN_WALK_MS = 3000;
const MAX_WALK_MS = 7000;
const IDLE_SQUISH_PERIOD_MS = 900;
const IDLE_SQUISH_AMOUNT = 0.08;
const WALK_STEP_MS = 260; // one hop (ground → peak → ground)
const WALK_BOB_HEIGHT = 5; // px lift at the peak of each hop
const WALK_SQUISH_AMOUNT = 0.05; // squash on ground contact
const SHAKE_INTERVAL_MS = 70; // how often the drag-shake jitter picks a new offset
const SHAKE_AMOUNT = 2; // px

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
 *
 * `enableSquish` (default true) can be turned off for content that's
 * expensive to rescale every frame — e.g. the Pig sprite is a ~1000-layer
 * CSS `box-shadow` pixel grid, and continuously changing `scaleY` on an
 * ancestor forces the browser to re-rasterize it on every animation frame,
 * which is enough to freeze the tab. Position (translate) and the hop bounce
 * stay on regardless, since pure translate is compositor-only and cheap.
 *
 * `onEnterIdle` fires every time a fresh idle pause begins (including right
 * after a drag ends), with the sprite's position at that moment — a caller
 * can use this to, say, pop up a speech bubble every few idles.
 *
 * While dragging, a small translate-only jitter (never scale/rotate, for the
 * same repaint-cost reason as `enableSquish`) is layered on top so the sprite
 * visibly shakes in the cursor's grip. `bubbleRef`, if given, gets the same
 * position (minus the jitter and facing flip) written to it every frame, so
 * a speech bubble element can float above the sprite and follow it exactly
 * — including mid-drag — without needing its own React state updates.
 *
 * The returned `goTo(x, y, onArrive, windUpMs)` interrupts idle/walking and
 * steers the sprite directly toward a specific point instead — e.g. "walk
 * over to Discord's close button" — calling `onArrive` once it's close
 * enough, then falling back to normal wandering from there. A drag still
 * takes priority and pauses it mid-route. With `windUpMs` > 0, it first
 * shakes in place (translate-only, same jitter as a drag) for that long
 * before actually moving — a little wind-up before charging off.
 *
 * `cancel()` aborts a pending wind-up or an in-progress `goTo` and returns
 * immediately to normal idle/wandering, without ever calling `onArrive`.
 */
export function useWander(
  elRef: RefObject<HTMLElement | null>,
  size: number,
  active: boolean,
  getBounds: () => { width: number; height: number },
  onDragStateChange?: (dragging: boolean) => void,
  enableSquish = true,
  onEnterIdle?: (position: { x: number; y: number }) => void,
  bubbleRef?: RefObject<HTMLElement | null>,
) {
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const facingRef = useRef(1);
  const modeRef = useRef<"idle" | "walking" | "goto" | "windup">("idle");
  const modeUntilRef = useRef(0);
  const idleStartRef = useRef(0);
  const walkStartRef = useRef(0);
  const windUpUntilRef = useRef(0);
  const targetRef = useRef<{ x: number; y: number; onArrive?: () => void } | null>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const shakeOffsetRef = useRef({ x: 0, y: 0 });
  const nextShakeAtRef = useRef(0);
  const frameRef = useRef(0);
  const getBoundsRef = useRef(getBounds);
  getBoundsRef.current = getBounds;
  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;
  const onEnterIdleRef = useRef(onEnterIdle);
  onEnterIdleRef.current = onEnterIdle;

  const goTo = useCallback(
    (x: number, y: number, onArrive?: () => void, windUpMs = 0) => {
      const { width, height } = getBoundsRef.current();
      const maxX = Math.max(0, width - size);
      const maxY = Math.max(0, height - size);
      targetRef.current = { x: clamp(x, 0, maxX), y: clamp(y, 0, maxY), onArrive };
      if (windUpMs > 0) {
        velRef.current = { x: 0, y: 0 };
        windUpUntilRef.current = performance.now() + windUpMs;
        modeRef.current = "windup";
      } else {
        modeRef.current = "goto";
      }
    },
    [size],
  );

  const cancel = useCallback(() => {
    targetRef.current = null;
    velRef.current = { x: 0, y: 0 };
    modeRef.current = "idle";
    const now = performance.now();
    idleStartRef.current = now;
    modeUntilRef.current = now + randRange(MIN_IDLE_MS, MAX_IDLE_MS);
  }, []);

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
      onEnterIdleRef.current?.({ ...posRef.current });
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
          if (modeRef.current === "windup") {
            if (now >= windUpUntilRef.current) modeRef.current = "goto";
          } else if (modeRef.current === "goto") {
            const dest = targetRef.current;
            if (dest) {
              const pos = posRef.current;
              const dx = dest.x - pos.x;
              const dy = dest.y - pos.y;
              const dist = Math.hypot(dx, dy);
              if (dist <= ARRIVE_DISTANCE) {
                pos.x = dest.x;
                pos.y = dest.y;
                targetRef.current = null;
                const onArrive = dest.onArrive;
                enterIdle(now);
                onArrive?.();
              } else {
                const vel = velRef.current;
                vel.x = (dx / dist) * GOTO_SPEED;
                vel.y = (dy / dist) * GOTO_SPEED;
                pos.x += vel.x;
                pos.y += vel.y;
                // The artwork's neutral pose faces left, so scaleX(1) reads as
                // "facing left" — moving right needs a mirror flip, not left.
                if (vel.x !== 0) facingRef.current = vel.x > 0 ? -1 : 1;
              }
            } else {
              enterIdle(now);
            }
          } else {
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
        }

        const pos = posRef.current;
        let squishY = 1;
        let bobY = 0;
        if (!draggingRef.current) {
          if (modeRef.current === "idle") {
            if (enableSquish) {
              const elapsed = now - idleStartRef.current;
              const phase = (elapsed / IDLE_SQUISH_PERIOD_MS) * Math.PI * 2;
              squishY = 1 - Math.sin(phase) * IDLE_SQUISH_AMOUNT;
            }
          } else if (modeRef.current !== "windup") {
            const elapsed = now - walkStartRef.current;
            const hop = Math.abs(Math.sin((elapsed / WALK_STEP_MS) * Math.PI));
            bobY = -hop * WALK_BOB_HEIGHT;
            if (enableSquish) squishY = 1 - (1 - hop) * WALK_SQUISH_AMOUNT;
          }
        }

        let shakeX = 0;
        let shakeY = 0;
        if (draggingRef.current || modeRef.current === "windup") {
          if (now >= nextShakeAtRef.current) {
            shakeOffsetRef.current = {
              x: (Math.random() - 0.5) * 2 * SHAKE_AMOUNT,
              y: (Math.random() - 0.5) * 2 * SHAKE_AMOUNT,
            };
            nextShakeAtRef.current = now + SHAKE_INTERVAL_MS;
          }
          shakeX = shakeOffsetRef.current.x;
          shakeY = shakeOffsetRef.current.y;
        }

        el.style.transform = `translate(${pos.x + shakeX}px, ${pos.y + bobY + shakeY}px) scaleX(${facingRef.current}) scaleY(${squishY})`;

        const bubbleEl = bubbleRef?.current;
        if (bubbleEl) {
          bubbleEl.style.transform = `translate(${pos.x}px, ${pos.y + bobY}px)`;
        }
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
  }, [active, elRef, size, enableSquish]);

  return { goTo, cancel };
}
