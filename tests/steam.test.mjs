import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ACHIEVEMENTS } from "../js/achieve.js";

const require = createRequire(import.meta.url);
const steam = require("../electron/steam.cjs");

test("steam achievement file matches the trophy case", () => {
  const file = JSON.parse(readFileSync(new URL("../steam/achievements.json", import.meta.url), "utf8"));
  assert.deepEqual(file.achievements.map((row) => row.id), ACHIEVEMENTS.map((row) => row.id));
  for (const row of file.achievements) {
    const def = ACHIEVEMENTS.find((item) => item.id === row.id);
    assert.equal(row.name, def.name);
    assert.equal(row.description, def.desc);
    assert.equal(row.hidden, def.hidden);
    assert.match(row.id, /^[a-z0-9_]{1,64}$/);
  }
});

test("the window icon is a 512 png", () => {
  const icon = readFileSync(new URL("../assets/icon.png", import.meta.url));
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(icon.readUInt32BE(16), 512);
  assert.equal(icon.readUInt32BE(20), 512);
});

test("the steam bridge stays quiet without the sdk", () => {
  assert.equal(steam.parseAppId("424242"), 424242);
  assert.equal(steam.parseAppId(" 480\n"), 480);
  assert.equal(steam.parseAppId("1.5"), null);
  assert.equal(steam.parseAppId("nope"), null);
  assert.equal(steam.parseAppId(""), null);
  assert.equal(steam.activateAchievement("First Light"), false);
  assert.equal(steam.activateAchievement("../passwd"), false);
  assert.equal(steam.activateAchievement("first_light"), false);
  const prev = process.env.FOC_STEAM_APP_ID;
  process.env.FOC_STEAM_APP_ID = "424242";
  assert.equal(steam.readAppId(), 424242);
  process.env.FOC_STEAM_APP_ID = "nope";
  assert.equal(steam.readAppId(), null);
  if (prev == null) delete process.env.FOC_STEAM_APP_ID;
  else process.env.FOC_STEAM_APP_ID = prev;
  assert.doesNotThrow(() => steam.prepareOverlay());
  assert.equal(steam.initSteam(), "module-missing");
  assert.equal(steam.steamStatus(), "module-missing");
});
