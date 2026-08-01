const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send("overlay:set-ignore-mouse-events", ignore, options),
  ready: () => ipcRenderer.send("overlay:ready"),
  onDiscordTarget: (handler) => {
    const listener = (_event, position) => handler(position);
    ipcRenderer.on("discord:target", listener);
    return () => ipcRenderer.removeListener("discord:target", listener);
  },
  onDiscordBlurred: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("discord:blurred", listener);
    return () => ipcRenderer.removeListener("discord:blurred", listener);
  },
  discordReached: () => ipcRenderer.send("discord:reached"),
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
