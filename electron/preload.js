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
});
contextBridge.exposeInMainWorld("statusAPI", {
  ready: () => ipcRenderer.send("status:ready"),
  onUpdate: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on("status:update", listener);
    return () => ipcRenderer.removeListener("status:update", listener);
  },
  onMemoryUpdate: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on("memory:update", listener);
    return () => ipcRenderer.removeListener("memory:update", listener);
  },
  requestManualCapture: () => ipcRenderer.send("status:manual-capture"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  // The renderer owns the definition of "away" and pushes the derived status up;
  // the main process only relays it to the pill.
  setBackgroundStatus: (status) => ipcRenderer.send("status:set", status),
  studyMemory: {
    getSources: () => ipcRenderer.invoke("study-memory:sources"),
    capture: (sourceId) => ipcRenderer.invoke("study-memory:capture", sourceId),
    setStatus: (status) => ipcRenderer.send("study-memory:status", status),
    onManualCapture: (handler) => {
      const listener = () => handler();
      ipcRenderer.on("study-memory:manual-capture", listener);
      return () => ipcRenderer.removeListener("study-memory:manual-capture", listener);
    },
  },
});
