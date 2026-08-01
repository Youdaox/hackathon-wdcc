/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

let dashboardWindow = null;
let overlayWindow = null;
let statusWindow = null;

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

function getStatusBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 300;
  const height = 64;
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
    statusWindow.setIgnoreMouseEvents(true, { forward: true });
    statusWindow.webContents.on("did-finish-load", () => {
      statusWindow?.webContents.send("status:update", status);
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
  });
}

// Toggled from the dashboard's "Let the duck out" button. Returns whether the
// overlay ended up open, so the button label can reflect the real state.
ipcMain.handle("overlay:toggle", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
    return false;
  }
  createOverlayWindow();
  return true;
});

ipcMain.on("overlay:set-ignore-mouse-events", (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, options);
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

app.whenReady().then(() => {
  createDashboardWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
