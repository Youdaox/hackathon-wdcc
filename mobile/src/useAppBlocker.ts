import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  type DistractionRecord,
  fetchDistractionList,
  logDistractionEvent,
  saveDistractionList,
} from "./api";
import * as AppBlocker from "../modules/app-blocker";

/**
 * Owns everything about app blocking: the two special permissions, the
 * restricted list, and the block events the native side reports.
 *
 * Blocking is Android-and-dev-build only. In Expo Go, and on iOS, the native
 * module is absent and every call is a no-op — `supported` is false and the UI
 * is expected to say so rather than pretend.
 */

export interface BlockerPermissions {
  usageAccess: boolean;
  overlay: boolean;
}

export function useAppBlocker() {
  const supported = AppBlocker.isSupported;

  const [permissions, setPermissions] = useState<BlockerPermissions>({
    usageAccess: false,
    overlay: false,
  });
  const [installed, setInstalled] = useState<AppBlocker.InstalledApp[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  /**
   * Blocks caught during the current session. Held in a ref because the native
   * listener fires outside React's cycle, and the list is read once at session
   * end rather than rendered.
   */
  const caught = useRef<DistractionRecord[]>([]);

  const refreshPermissions = useCallback(() => {
    if (!supported) return;
    setPermissions({
      usageAccess: AppBlocker.hasUsageAccess(),
      overlay: AppBlocker.hasOverlayPermission(),
    });
  }, [supported]);

  // Initial load: permissions and installed apps are native reads, the
  // selected list comes from the server so it matches the web settings.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      refreshPermissions();
      if (supported) setInstalled(AppBlocker.getInstalledApps());
      try {
        const apps = await fetchDistractionList();
        if (!cancelled) setSelected(apps);
      } catch {
        // Offline is survivable — the user can still toggle locally and the
        // next successful save pushes the whole set.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [supported, refreshPermissions]);

  // Both permissions are granted in a Settings screen outside this app, so
  // there is no callback — the only reliable moment to re-check is when the
  // user comes back.
  useEffect(() => {
    if (!supported) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshPermissions();
    });
    return () => subscription.remove();
  }, [supported, refreshPermissions]);

  // The native side reports every block screen outcome, bypassed or not. They
  // are logged immediately so a bypass survives an unclean session end, and
  // also kept for the session payload.
  useEffect(() => {
    if (!supported) return;
    return AppBlocker.addDistractionListener((event) => {
      caught.current.push({
        startedAt: Date.now() - event.durationMs,
        durationMs: event.durationMs,
        appIdentifier: event.packageName,
        bypassed: event.bypassed,
      });
      void logDistractionEvent({
        appIdentifier: event.packageName,
        durationMs: event.durationMs,
        bypassed: event.bypassed,
      }).catch(() => {
        // Already captured for the end-of-session payload; a failed live log
        // is not worth surfacing mid-session.
      });
    });
  }, [supported]);

  const toggle = useCallback(
    (packageName: string, value: boolean) => {
      setSelected((current) => {
        const next = value
          ? [...new Set([...current, packageName])]
          : current.filter((p) => p !== packageName);
        // Fire-and-forget: the toggle should feel instant, and the list is
        // replaced wholesale so a lost write self-heals on the next toggle.
        void saveDistractionList(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  /** Called when a focus session starts. */
  const beginBlocking = useCallback(() => {
    caught.current = [];
    if (!supported) return;
    if (!permissions.usageAccess || !permissions.overlay) return;
    if (selected.length === 0) return;
    AppBlocker.startBlocking(selected);
  }, [supported, permissions, selected]);

  /** Called when a session ends. Returns what the blocker caught. */
  const endBlocking = useCallback((): DistractionRecord[] => {
    if (supported) AppBlocker.stopBlocking();
    const events = caught.current;
    caught.current = [];
    return events;
  }, [supported]);

  const ready = supported && permissions.usageAccess && permissions.overlay;

  return {
    supported,
    ready,
    permissions,
    installed,
    selected,
    loaded,
    toggle,
    refreshPermissions,
    beginBlocking,
    endBlocking,
    requestUsageAccess: AppBlocker.openUsageAccessSettings,
    requestOverlay: AppBlocker.openOverlaySettings,
  };
}
