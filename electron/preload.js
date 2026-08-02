/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send("overlay:set-ignore-mouse-events", ignore, options),
  ready: () => ipcRenderer.send("overlay:ready"),
  onTargetAppFocus: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("target-app:focus", listener);
    return () => ipcRenderer.removeListener("target-app:focus", listener);
  },
  onTargetAppBlur: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("target-app:blur", listener);
    return () => ipcRenderer.removeListener("target-app:blur", listener);
  },
  targetAppReached: (name) => ipcRenderer.send("target-app:reached", name),
  onCompanionUpdate: (handler) => {
    const listener = (_event, companion) => handler(companion);
    ipcRenderer.on("companion:update", listener);
    return () => ipcRenderer.removeListener("companion:update", listener);
  },
});
contextBridge.exposeInMainWorld("statusAPI", {
  ready: () => ipcRenderer.send("status:ready"),
  onUpdate: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on("status:update", listener);
    return () => ipcRenderer.removeListener("status:update", listener);
  },
});

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  closeOverlay: () => ipcRenderer.send("overlay:close"),
  // The renderer owns the definition of "away" and pushes the derived status up;
  // the main process only relays it to the pill.
  setBackgroundStatus: (status) => ipcRenderer.send("status:set", status),
  // The dashboard and overlay are separate windows with their own InclineProvider
  // instances — this keeps the overlay's pet visually in sync (color, accessory,
  // level, mood) with whatever the dashboard's is doing live, not just at the
  // moment the overlay was opened.
  updateCompanion: (companion) => ipcRenderer.send("companion:update", companion),
  studyMemory: {
    getSources: () => ipcRenderer.invoke("study-memory:sources"),
    capture: (sourceId) => ipcRenderer.invoke("study-memory:capture", sourceId),
  },
});
