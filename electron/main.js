/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
const { isDiscord, closeButtonPosition, closeDiscord } = require("./closeApp");

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const DISCORD_POLL_MS = 500;

let dashboardWindow = null;
let overlayWindow = null;
let statusWindow = null;
let trackingActive = false;
let discordWatchTimer = null;
let discordWasFocused = false;

// get-windows ships ESM-only; dynamic import works from this CommonJS file
// without needing to convert the whole main process to ESM.
let activeWindowPromise;
function getActiveWindow() {
  activeWindowPromise ??= import("get-windows");
  return activeWindowPromise.then((mod) => mod.activeWindow());
}

function startDiscordWatch() {
  // Reset so a window that's already focused when the pet comes out still
  // counts as a fresh "just focused" trigger, not something already seen.
  discordWasFocused = false;
  if (discordWatchTimer) return;
  discordWatchTimer = setInterval(async () => {
    if (!overlayWindow) return;
    try {
      const win = await getActiveWindow();
      const focused = Boolean(win && isDiscord(win.owner?.name));
      if (focused && !discordWasFocused) {
        overlayWindow.webContents.send("discord:target", closeButtonPosition(win.bounds));
      } else if (!focused && discordWasFocused) {
        // Tabbed away before the pet reached it — call off the pursuit.
        overlayWindow.webContents.send("discord:blurred");
      }
      discordWasFocused = focused;
    } catch {
      // Most likely macOS Accessibility permission hasn't been granted yet —
      // just skip this tick rather than crashing the watch loop.
    }
  }, DISCORD_POLL_MS);
}

function stopDiscordWatch() {
  if (discordWatchTimer) {
    clearInterval(discordWatchTimer);
    discordWatchTimer = null;
  }
}

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
  const dashboardFocused = dashboardWindow?.isFocused?.() ?? false;
  const shouldShow = trackingActive;
  const state = trackingActive
    ? dashboardFocused
      ? { mode: "focused", label: "Focused", tone: "bg-moss" }
      : { mode: "unfocused", label: "Unfocused", tone: "bg-red-500" }
    : { mode: "idle", label: "Tracking off", tone: "bg-faint" };

  if (!shouldShow) {
    if (statusWindow) {
      statusWindow.webContents.send("status:update", state);
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
      statusWindow?.webContents.send("status:update", state);
    });
    statusWindow.loadURL(`${APP_URL}/status`);
    statusWindow.on("closed", () => {
      statusWindow = null;
    });
    return;
  }

  statusWindow.setBounds(getStatusBounds());
  statusWindow.webContents.send("status:update", state);
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
  dashboardWindow.on("focus", syncStatusWindow);
  dashboardWindow.on("blur", syncStatusWindow);
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
    stopDiscordWatch();
  });
}

// Toggled from the dashboard's "Let the duck out" button. Returns whether the
// overlay ended up open, so the button label can reflect the real state.
ipcMain.handle("overlay:toggle", () => {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
    stopDiscordWatch();
    return false;
  }
  createOverlayWindow();
  startDiscordWatch();
  return true;
});

// The overlay page sends this once the pet has walked up to Discord's close
// button — see closeApp.js for why this runs the real quit command rather
// than simulating an actual OS-level mouse click.
//
// Deliberately not resetting discordWasFocused here: the quit can take a
// moment, and if the next poll tick still sees Discord focused while this
// flag were reset to false, it would misread that as a brand new focus event
// and send the pet running at it again mid-quit. Leaving it true means the
// eventual real blur (once Discord actually closes) is what fires next, and
// by then the pet's already back to idle, so it's a harmless no-op.
ipcMain.on("discord:reached", () => {
  closeDiscord();
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

ipcMain.on("tracking:set-active", (_event, active) => {
  trackingActive = Boolean(active);
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
