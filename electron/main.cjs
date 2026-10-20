const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const steam = require("./steam.cjs");

steam.prepareOverlay();

function autosavePath() {
  return path.join(app.getPath("userData"), "saves", "autosave.json");
}

ipcMain.handle("foc-read-autosave", () => {
  try {
    return fs.readFileSync(autosavePath(), "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("foc-write-autosave", (_event, text) => {
  if (typeof text !== "string" || text.length > 8_000_000) return false;
  const file = autosavePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
});

ipcMain.handle("foc-activate-achievement", (_event, id) => steam.activateAchievement(id));

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#12100d",
    title: "Front Office Corner",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  if (steam.initSteam() === "restarting") {
    app.quit();
    return;
  }
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
