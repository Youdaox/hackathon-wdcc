/**
 * Tracks the active Document Picture-in-Picture window (the browser-tab
 * fallback for the desktop pet, see DesktopBuddy.tsx) outside of React state.
 *
 * Needed because logging out needs to close it as a direct side effect of
 * the logout action — the dashboard (and DesktopBuddy along with it) unmounts
 * on logout, so nothing survives long enough to reactively observe that
 * transition and close it from inside the component itself.
 */
let activePipWindow: Window | null = null;

export function setActivePipWindow(win: Window | null) {
  activePipWindow = win;
}

export function closeActivePipWindow() {
  activePipWindow?.close();
  activePipWindow = null;
}
