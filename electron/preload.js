const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send("overlay:set-ignore-mouse-events", ignore, options),
});
