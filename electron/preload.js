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
  setBackgroundTracking: (active) => ipcRenderer.send("tracking:set-active", active),
});
