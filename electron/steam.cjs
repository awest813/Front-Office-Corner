const fs = require("fs");
const path = require("path");

const ID_RE = /^[a-z0-9_]{1,64}$/;

let client = null;
let status = "off";

function parseAppId(text) {
  if (text == null) return null;
  const n = Number(String(text).trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function readAppId() {
  const fromEnv = parseAppId(process.env.FOC_STEAM_APP_ID);
  if (fromEnv) return fromEnv;
  const roots = [
    process.cwd(),
    path.dirname(process.execPath),
    process.resourcesPath,
    path.join(__dirname, ".."),
  ].filter(Boolean);
  const seen = new Set();
  for (const root of roots) {
    const file = path.join(root, "steam_appid.txt");
    if (seen.has(file)) continue;
    seen.add(file);
    try {
      const id = parseAppId(fs.readFileSync(file, "utf8"));
      if (id) return id;
    } catch {
      /* The file is optional. The example in steam/ is never read. */
    }
  }
  return null;
}

function loadLibrary() {
  try {
    return require("steamworks.js");
  } catch {
    return null;
  }
}

function prepareOverlay() {
  const steam = loadLibrary();
  if (!steam || typeof steam.electronEnableSteamOverlay !== "function") return;
  try {
    steam.electronEnableSteamOverlay();
  } catch (err) {
    console.log("[steam] overlay skipped:", err && err.message ? err.message : err);
  }
}

function initSteam() {
  const steam = loadLibrary();
  if (!steam) {
    status = "module-missing";
    console.log("[steam] steamworks.js is not installed. Trophies stay in the game.");
    return status;
  }
  const appId = readAppId();
  if (!appId) {
    status = "no-app-id";
    console.log("[steam] no app id. Set FOC_STEAM_APP_ID or place steam_appid.txt beside the executable.");
    return status;
  }
  try {
    if (typeof steam.restartAppIfNecessary === "function" && steam.restartAppIfNecessary(appId)) {
      status = "restarting";
      console.log("[steam] restarting through Steam");
      return status;
    }
    if (typeof steam.init !== "function") {
      status = "init-failed";
      console.log("[steam] init is missing");
      return status;
    }
    client = steam.init(appId);
    status = "ready";
    console.log("[steam] ready", appId);
    return status;
  } catch (err) {
    client = null;
    status = "init-failed";
    console.log("[steam] init failed:", err && err.message ? err.message : err);
    return status;
  }
}

function activateAchievement(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) return false;
  if (!client) return false;
  try {
    if (client.achievement && typeof client.achievement.activate === "function") {
      client.achievement.activate(id);
      return true;
    }
    if (typeof client.activateAchievement === "function") {
      client.activateAchievement(id);
      return true;
    }
  } catch (err) {
    console.log("[steam] activate failed:", err && err.message ? err.message : err);
  }
  return false;
}

function steamStatus() {
  return status;
}

module.exports = {
  parseAppId,
  readAppId,
  prepareOverlay,
  initSteam,
  activateAchievement,
  steamStatus,
};
