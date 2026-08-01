const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send("overlay:set-ignore-mouse-events", ignore, options),
});

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
});
