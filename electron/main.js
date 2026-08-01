const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

let dashboardWindow = null;
let overlayWindow = null;

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  dashboardWindow.loadURL(APP_URL);
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
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // Keep it above other windows, including fullscreen apps, on macOS.
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through by default; the overlay page tells us (via IPC) when the
  // cursor is over the duck so it can re-enable hit testing just there.
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

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

app.whenReady().then(() => {
  createDashboardWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
