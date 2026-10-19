const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("foc", {
  readAutosave: () => ipcRenderer.invoke("foc-read-autosave"),
  writeAutosave: (text) => ipcRenderer.invoke("foc-write-autosave", text),
  activateAchievement: (id) => ipcRenderer.invoke("foc-activate-achievement", id),
});
