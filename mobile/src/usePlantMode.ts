import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { DeviceMotion, type DeviceMotionMeasurement } from "expo-sensors";

export type PlantPhase =
  | "idle"
  | "waiting"
  | "calibrating"
  | "planted"
  | "pickedUp"
  | "unavailable";

export interface PlantModeState {
  active: boolean;
  trackingSession: boolean;
  phase: PlantPhase;
  calibrationProgress: number;
  pickupCount: number;
  error: string | null;
}

export interface PlantSessionSummary {
  phonePickups: number;
  plantedMs: number;
  plantedPercentage: number;
  longestPlantedMs: number;
}

const KEEP_AWAKE_TAG = "incline-plant-mode";
const SENSOR_INTERVAL_MS = 200;
const REQUIRED_STABLE_MS = 1_500;
const GRAVITY_FLAT_THRESHOLD = 7.2;
const MOTION_THRESHOLD = 1.15;
const Z_DRIFT_THRESHOLD = 1.1;
const WINDOW_SIZE = 5;

const initialState: PlantModeState = {
  active: false,
  trackingSession: false,
  phase: "idle",
  calibrationProgress: 0,
  pickupCount: 0,
  error: null,
};

function magnitude(vector: { x: number; y: number; z: number } | null): number {
  if (!vector) return 0;
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

/**
 * Face-down verification for the Expo Go build.
 *
 * Expo normalizes iOS and Android so gravity points along positive Z while the
 * screen faces down. Requiring that direction (rather than only checking that
 * the phone is flat) prevents a face-up phone from earning verified time. No
 * raw motion samples leave the device; callers only receive deliberate
 * planted/picked-up transitions.
 */
export function usePlantMode({
  onPlantedChange,
}: {
  onPlantedChange: (planted: boolean) => void;
}) {
  const [state, setState] = useState<PlantModeState>(initialState);
  const stateRef = useRef<PlantModeState>(initialState);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const callbackRef = useRef(onPlantedChange);
  const zWindowRef = useRef<number[]>([]);
  const previousZRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const plantedSinceRef = useRef<number | null>(null);
  const plantedTotalRef = useRef(0);
  const longestPlantedRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onPlantedChange;
  }, [onPlantedChange]);

  const publish = useCallback((patch: Partial<PlantModeState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const closePlantedStretch = useCallback((now: number) => {
    const plantedSince = plantedSinceRef.current;
    if (plantedSince == null) return;
    const duration = Math.max(0, now - plantedSince);
    plantedTotalRef.current += duration;
    longestPlantedRef.current = Math.max(longestPlantedRef.current, duration);
    plantedSinceRef.current = null;
  }, []);

  const markPlanted = useCallback(
    (now: number) => {
      if (stateRef.current.phase === "planted") return;
      plantedSinceRef.current = now;
      stableSinceRef.current = null;
      publish({ phase: "planted", calibrationProgress: 1, error: null });
      callbackRef.current(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    [publish],
  );

  const markPickedUp = useCallback(
    (now: number) => {
      if (stateRef.current.phase !== "planted") return;
      closePlantedStretch(now);
      stableSinceRef.current = null;
      const pickupCount = stateRef.current.pickupCount + (sessionStartedAtRef.current == null ? 0 : 1);
      publish({ phase: "pickedUp", calibrationProgress: 0, pickupCount });
      callbackRef.current(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    },
    [closePlantedStretch, publish],
  );

  const handleMeasurement = useCallback(
    (measurement: DeviceMotionMeasurement) => {
      if (!stateRef.current.active) return;
      const gravity = measurement.accelerationIncludingGravity;
      const rawZ = gravity.z;
      const window = zWindowRef.current;
      window.push(rawZ);
      if (window.length > WINDOW_SIZE) window.shift();
      const smoothedZ = window.reduce((sum, value) => sum + value, 0) / window.length;
      const previousZ = previousZRef.current;
      previousZRef.current = smoothedZ;

      const movement = magnitude(measurement.acceleration);
      const zDrift = previousZ == null ? 0 : Math.abs(smoothedZ - previousZ);
      const faceDown = smoothedZ >= GRAVITY_FLAT_THRESHOLD;
      const still = movement <= MOTION_THRESHOLD && zDrift <= Z_DRIFT_THRESHOLD;
      const now = Date.now();

      if (stateRef.current.phase === "planted") {
        if (!faceDown || !still) markPickedUp(now);
        return;
      }

      if (!faceDown || !still) {
        stableSinceRef.current = null;
        publish({
          phase: stateRef.current.phase === "pickedUp" ? "pickedUp" : "waiting",
          calibrationProgress: 0,
        });
        return;
      }

      if (stableSinceRef.current == null) stableSinceRef.current = now;
      const progress = Math.min(1, (now - stableSinceRef.current) / REQUIRED_STABLE_MS);
      publish({ phase: "calibrating", calibrationProgress: progress });

      if (progress >= 1) markPlanted(now);
    },
    [markPickedUp, markPlanted, publish],
  );

  const removeSensor = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const begin = useCallback(async () => {
    const generation = ++generationRef.current;
    removeSensor();
    zWindowRef.current = [];
    previousZRef.current = null;
    stableSinceRef.current = null;
    sessionStartedAtRef.current = null;
    plantedSinceRef.current = null;
    plantedTotalRef.current = 0;
    longestPlantedRef.current = 0;
    publish({ ...initialState, active: true, phase: "waiting" });
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});

    try {
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) throw new Error("Motion sensing is not available on this phone.");
      const permission = await DeviceMotion.requestPermissionsAsync();
      if (!permission.granted) throw new Error("Motion permission is needed for Plant-to-Focus.");
      if (generation !== generationRef.current || !stateRef.current.active) return;

      DeviceMotion.setUpdateInterval(SENSOR_INTERVAL_MS);
      subscriptionRef.current = DeviceMotion.addListener(handleMeasurement);
    } catch (error) {
      if (generation !== generationRef.current) return;
      removeSensor();
      publish({
        active: true,
        phase: "unavailable",
        calibrationProgress: 0,
        error: error instanceof Error ? error.message : "Motion sensing could not start.",
      });
    }
  }, [handleMeasurement, publish, removeSensor]);

  /** Resets metrics at the exact moment the calibrated session begins. */
  const confirmSessionStarted = useCallback(() => {
    const now = Date.now();
    sessionStartedAtRef.current = now;
    plantedTotalRef.current = 0;
    longestPlantedRef.current = 0;
    plantedSinceRef.current = stateRef.current.phase === "planted" ? now : null;
    publish({ pickupCount: 0, trackingSession: true });
  }, [publish]);

  const stop = useCallback((): PlantSessionSummary | null => {
    const now = Date.now();
    closePlantedStretch(now);
    const startedAt = sessionStartedAtRef.current;
    const elapsed = startedAt == null ? 0 : Math.max(0, now - startedAt);
    const summary =
      startedAt == null
        ? null
        : {
            phonePickups: stateRef.current.pickupCount,
            plantedMs: plantedTotalRef.current,
            plantedPercentage:
              elapsed === 0
                ? 0
                : Math.min(100, Math.round((plantedTotalRef.current / elapsed) * 100)),
            longestPlantedMs: longestPlantedRef.current,
          };

    ++generationRef.current;
    removeSensor();
    void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    stateRef.current = initialState;
    if (mountedRef.current) setState(initialState);
    callbackRef.current(false);
    sessionStartedAtRef.current = null;
    return summary;
  }, [closePlantedStretch, removeSensor]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== "active" && stateRef.current.active) markPickedUp(Date.now());
    });
    return () => subscription.remove();
  }, [markPickedUp]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stateRef.current = { ...stateRef.current, active: false };
      removeSensor();
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [removeSensor]);

  return { state, begin, confirmSessionStarted, stop };
}
