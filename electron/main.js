const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");

const OVERLAY_URL = process.env.OVERLAY_URL ?? "http://localhost:3000/overlay";

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  const win = new BrowserWindow({
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
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Click-through by default; the overlay page tells us (via IPC) when the
  // cursor is over the duck so it can re-enable hit testing just there.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadURL(OVERLAY_URL);

  return win;
}

ipcMain.on("overlay:set-ignore-mouse-events", (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.setIgnoreMouseEvents(ignore, options);
});

app.whenReady().then(() => {
  createOverlayWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
