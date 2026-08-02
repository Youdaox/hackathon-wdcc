/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, screen } = require("electron");
const path = require("node:path");
const { matchTargetApp, closeButtonPosition, closeTargetApp } = require("./closeApp");

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const APP_WATCH_POLL_MS = 500;
const REACHED_RESET_DELAY_MS = 2000;

let dashboardWindow = null;
let overlayWindow = null;
let statusWindow = null;
let appWatchTimer = null;
// Name of whichever target app (see closeApp.js's TARGET_APPS) was focused
// on the last poll tick, or null — used to edge-detect focus/blur so each
// only fires once per transition, not every tick while it stays focused.
let focusedTargetApp = null;

/**
 * The latest status pushed up from the dashboard renderer.
 *
 * The main process deliberately does not work this out for itself. It used to,
 * from `dashboardWindow.isFocused()` — but the session scores "away" as
 * `document.hidden || gaze`, so OS window focus disagreed with the scoring in
 * both directions: a dashboard sitting visible beside a PDF read as "Unfocused"
 * while the session counted it as focused, and a focused window with the user's
 * eyes elsewhere read as "Focused" while their companion was losing health.
 * Only the renderer knows what away means, so it is the one that decides.
 */
let status = { phase: "idle" };
let memoryStatus = {
  enabled: false,
  automaticPaused: false,
  phase: "off",
  acceptedCaptures: 0,
  sourceName: null,
  message: null,
};

// get-windows ships ESM-only; dynamic import works from this CommonJS file
// without needing to convert the whole main process to ESM.
let activeWindowPromise;
function getActiveWindow() {
  activeWindowPromise ??= import("get-windows");
  return activeWindowPromise.then((mod) => mod.activeWindow());
}

function startAppWatch() {
  // Reset so an app that's already focused when the pet comes out still
  // counts as a fresh "just focused" trigger, not something already seen.
  focusedTargetApp = null;
  if (appWatchTimer) return;
  appWatchTimer = setInterval(async () => {
    if (!overlayWindow) return;
    try {
      const win = await getActiveWindow();
      const name = win ? matchTargetApp(win.owner?.name) : null;
      if (name && name !== focusedTargetApp) {
        overlayWindow.webContents.send("target-app:focus", { name, position: closeButtonPosition(win.bounds) });
      } else if (!name && focusedTargetApp) {
        // Tabbed away before the pet reached it — call off the pursuit.
        overlayWindow.webContents.send("target-app:blur", { name: focusedTargetApp });
      }
      focusedTargetApp = name;
    } catch {
      // Most likely macOS Accessibility permission hasn't been granted yet —
      // just skip this tick rather than crashing the watch loop.
    }
  }, APP_WATCH_POLL_MS);
}

function stopAppWatch() {
  if (appWatchTimer) {
    clearInterval(appWatchTimer);
    appWatchTimer = null;
  }
}

function getStatusBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 380;
  const height = 76;
  const margin = 16;
  return {
    x: workArea.x + workArea.width - width - margin,
    y: workArea.y + workArea.height - height - margin,
    width,
    height,
  };
}

function syncStatusWindow() {
  // The pill follows the *session*, not the camera. Gating it on eye tracking
  // meant a perfectly ordinary session got no desktop status at all.
  const shouldShow = status.phase !== "idle";

  if (!shouldShow) {
    if (statusWindow) {
      statusWindow.webContents.send("status:update", status);
      statusWindow.hide();
    }
    return;
  }

  if (!statusWindow) {
    statusWindow = new BrowserWindow({
      ...getStatusBounds(),
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      fullscreenable: false,
      focusable: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });

    statusWindow.setAlwaysOnTop(true, "screen-saver");
    statusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Interactive without taking focus away from the study material.
    statusWindow.setIgnoreMouseEvents(false);
    statusWindow.webContents.on("did-finish-load", () => {
      statusWindow?.webContents.send("status:update", status);
      statusWindow?.webContents.send("memory:update", memoryStatus);
    });
    statusWindow.loadURL(`${APP_URL}/status`);
    statusWindow.on("closed", () => {
      statusWindow = null;
    });
    return;
  }

  statusWindow.setBounds(getStatusBounds());
  statusWindow.webContents.send("status:update", status);
  if (!statusWindow.isVisible()) statusWindow.showInactive();
}

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  dashboardWindow.loadURL(APP_URL);
  // `focus` and `blur` are deliberately not listened for. They were what drove
  // the old state, and window focus is not what "away" means — the renderer
  // reports that. These remaining events only re-assert the pill's bounds and
  // visibility; minimising also flips `document.hidden`, so the renderer pushes
  // the phase change itself.
  dashboardWindow.on("minimize", syncStatusWindow);
  dashboardWindow.on("restore", syncStatusWindow);
  dashboardWindow.on("show", syncStatusWindow);
  dashboardWindow.on("hide", syncStatusWindow);
  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    fullscreenable: false,
    alwaysOnTop: true,
    // Wait for the transparent page to actually paint before showing —
    // otherwise Chromium's opaque default background flashes white first.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  // Keep it above other windows, including fullscreen apps, on macOS.
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through by default; the overlay page tells us (via IPC) when the
  // cursor is over the duck so it can re-enable hit testing just there.
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Fallback in case the page never signals "ready" (e.g. it errors before
  // mounting) — better a brief flash than a window stuck invisible forever.
  const fallbackShow = setTimeout(() => overlayWindow?.show(), 2000);
  overlayWindow.once("show", () => clearTimeout(fallbackShow));

  overlayWindow.loadURL(`${APP_URL}/overlay`);
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    stopAppWatch();
  });
}

// Toggled from the dashboard's "Let the duck out" button. Returns whether the
// overlay ended up open, so the button label can reflect the real state.
ipcMain.handle("overlay:toggle", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
    stopAppWatch();
    return false;
  }
  createOverlayWindow();
  startAppWatch();
  return true;
});

// Idempotent close — unlike overlay:toggle, this doesn't flip state, it just
// guarantees the overlay ends up closed. Used on logout (see demo-auth.tsx),
// which needs to close it as a direct side effect of the logout action
// itself, not by reacting to a state change after the fact: the dashboard
// unmounts on logout, so nothing survives to observe that transition.
ipcMain.on("overlay:close", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
    stopAppWatch();
  }
});

// The overlay page sends this once the pet has walked up to a target app's
// close button — see closeApp.js for why this runs the real quit command
// rather than simulating an actual OS-level mouse click.
//
// Not resetting focusedTargetApp immediately: the quit can take a moment,
// and if the very next poll tick still saw the app focused right after an
// immediate reset, it would misread that as a brand new focus event and
// send the pet running at it again mid-quit. The natural blur (once the app
// actually closes) normally clears it — this bounded fallback reset is a
// safety net in case that blur is ever missed, so a target app can never get
// permanently stuck and ignored for the rest of the session. Guarded so it
// only clears the slot if nothing else (a real blur, or a newer app) already
// has by the time it fires.
ipcMain.on("target-app:reached", (_event, name) => {
  closeTargetApp(name);
  setTimeout(() => {
    if (focusedTargetApp === name) focusedTargetApp = null;
  }, REACHED_RESET_DELAY_MS);
});

ipcMain.on("overlay:set-ignore-mouse-events", (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, options);
});

// Relayed from the dashboard window to whichever overlay window is currently
// open, so the desktop pet's look/mood stays live-synced with the dashboard
// instead of only reflecting whatever it was when the overlay last opened.
ipcMain.on("companion:update", (_event, companion) => {
  overlayWindow?.webContents.send("companion:update", companion);
});

// The overlay page sends this once it has actually applied its transparent
// background (see src/app/overlay/page.tsx) — only then is it safe to reveal
// the window without a flash of Chromium's default white background.
ipcMain.on("overlay:ready", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.show();
});

ipcMain.on("status:ready", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.showInactive();
});

ipcMain.on("status:set", (_event, next) => {
  status = next && typeof next.phase === "string" ? next : { phase: "idle" };
  syncStatusWindow();
});

ipcMain.on("study-memory:status", (_event, next) => {
  if (!next || typeof next.phase !== "string") return;
  memoryStatus = next;
  statusWindow?.webContents.send("memory:update", memoryStatus);
});

ipcMain.on("status:manual-capture", () => {
  dashboardWindow?.webContents.send("study-memory:manual-capture");
});

// Study Memory deliberately exposes snapshots, not an unrestricted media
// stream. The authenticated renderer decides when a focus session is active
// and uploads a short-lived data URL; the main process never writes images.
ipcMain.handle("study-memory:sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  });
  return sources
    .filter((source) => !/incline/i.test(source.name))
    .map((source) => ({ id: source.id, name: source.name }));
});

ipcMain.handle("study-memory:capture", async (_event, sourceId) => {
  if (typeof sourceId !== "string" || !/^(screen|window):/.test(sourceId)) return null;
  const sources = await desktopCapturer.getSources({
    types: [sourceId.startsWith("screen:") ? "screen" : "window"],
    thumbnailSize: { width: 1280, height: 720 },
    fetchWindowIcons: false,
  });
  const source = sources.find((candidate) => candidate.id === sourceId);
  if (!source || /incline/i.test(source.name) || source.thumbnail.isEmpty()) return null;
  return { sourceName: source.name, imageDataUrl: source.thumbnail.toJPEG(72).toString("base64") };
});

app.whenReady().then(() => {
  createDashboardWindow();
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (status.phase !== "idle" && memoryStatus.enabled) {
      dashboardWindow?.webContents.send("study-memory:manual-capture");
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
