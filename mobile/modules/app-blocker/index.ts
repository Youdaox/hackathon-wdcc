import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/**
 * Android app blocking.
 *
 * Loaded optionally on purpose. This module only exists in a development or
 * production build — in Expo Go there is no native code, and on iOS there is
 * no legal way to implement it (Apple never discloses the foregrounded app,
 * and shielding needs an Apple-granted FamilyControls entitlement).
 *
 * Every function below degrades to a no-op when the module is absent, so the
 * rest of the app runs unchanged in Expo Go. Check `isSupported` before
 * showing any blocking UI.
 */

export interface InstalledApp {
  packageName: string;
  label: string;
  isSystem: boolean;
}

export interface DistractionEvent {
  packageName: string;
  durationMs: number;
  /** True when the user tapped "5 more minutes" rather than backing off. */
  bypassed: boolean;
}

type AppBlockerEvents = {
  onDistraction: (event: DistractionEvent) => void;
};

declare class AppBlockerModuleType extends NativeModule<AppBlockerEvents> {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  getInstalledApps(): InstalledApp[];
  startBlocking(packages: string[]): void;
  stopBlocking(): void;
}

const native = requireOptionalNativeModule<AppBlockerModuleType>("AppBlocker");

/**
 * True only in an Android dev/production build with the module compiled in.
 * False in Expo Go and always false on iOS.
 */
export const isSupported = Platform.OS === "android" && native != null;

export function hasUsageAccess(): boolean {
  return native?.hasUsageAccess() ?? false;
}

export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

export function hasOverlayPermission(): boolean {
  return native?.hasOverlayPermission() ?? false;
}

export function openOverlaySettings(): void {
  native?.openOverlaySettings();
}

export function getInstalledApps(): InstalledApp[] {
  return native?.getInstalledApps() ?? [];
}

export function startBlocking(packages: string[]): void {
  native?.startBlocking(packages);
}

export function stopBlocking(): void {
  native?.stopBlocking();
}

/** Subscribes to block-screen outcomes. Returns an unsubscribe function. */
export function addDistractionListener(
  listener: (event: DistractionEvent) => void,
): () => void {
  if (!native) return () => {};
  const subscription = native.addListener("onDistraction", listener);
  return () => subscription.remove();
}
