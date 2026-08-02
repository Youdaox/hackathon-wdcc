/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send("overlay:set-ignore-mouse-events", ignore, options),
  ready: () => ipcRenderer.send("overlay:ready"),
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
  // The renderer owns the definition of "away" and pushes the derived status up;
  // the main process only relays it to the pill.
  setBackgroundStatus: (status) => ipcRenderer.send("status:set", status),
  studyMemory: {
    getSources: () => ipcRenderer.invoke("study-memory:sources"),
    capture: (sourceId) => ipcRenderer.invoke("study-memory:capture", sourceId),
  },
});
