import assert from "node:assert/strict";
import test from "node:test";
import {
  audit,
  createCareer,
  hydrate,
  openCamp,
  openSeason,
  respondInbox,
  serialize,
  setFocus,
  simWeek,
} from "../js/career.js";
import { playerReport, playerRole } from "../js/report.js";

test("a scouting report names the player and hides raw grades when the fog is thick", () => {
  const state = createCareer({ seed: 5, teamId: "gulls", gmName: "Casey Quinn" });
  const own = state.players[state.teams.find((t) => t.id === "gulls").active[0]];
  const report = playerReport(own, 0);
  assert.match(report, new RegExp(own.last));
  assert.match(report, /\(\d+\)/);
  assert.equal(typeof playerRole(own), "string");
  const other = Object.values(state.players).find((p) => p.teamId && p.teamId !== "gulls");
  const fogged = playerReport(other, 10);
  assert.match(fogged, new RegExp(other.last));
  assert.doesNotMatch(fogged, /\(\d+\)/);
  for (const p of Object.values(state.players)) {
    assert.ok(playerReport(p, p.scoutNoise || 0).length > 20);
  }
});

test("the development slate takes two young farm players and moves a prospect", () => {
  const state = createCareer({ seed: 4, teamId: "otters", situation: "rebuild" });
  const team = state.teams.find((t) => t.id === state.userTeamId);
  const kids = team.farm.map((id) => state.players[id]).filter((p) => !p.isPitcher);
  const kid = kids[0];
  const second = kids[1];
  const third = kids[2];
  for (const key of ["contact", "power", "eye", "speed", "defense", "arm"]) kid[key] = 40;
  kid.age = 20;
  kid.potential = 76;
  const before = Math.max(kid.contact, kid.power, kid.eye, kid.speed, kid.defense, kid.arm);
  assert.equal(setFocus(state, kid.id).ok, true);
  assert.equal(setFocus(state, second.id).ok, true);
  assert.equal(setFocus(state, third.id).ok, false);
  assert.equal(setFocus(state, team.active[0]).ok, false);
  assert.equal(setFocus(state, second.id).ok, true);
  assert.deepEqual(state.focus, [kid.id]);
  state.phase = "camp";
  const opened = openCamp(state);
  assert.equal(opened.ok, true, opened.message);
  const afterP = state.players[kid.id];
  const after = Math.max(afterP.contact, afterP.power, afterP.eye, afterP.speed, afterP.defense, afterP.arm);
  assert.ok(after >= before + 1, `tools ${before} -> ${after}`);
  assert.ok(state.growth);
  assert.match(state.paper.body, /slate|winter|step/);
  assert.equal(audit(state).length, 0, audit(state).join("; "));
});

test("a claim and a call-up change the roster and an old save still loads", () => {
  const state = createCareer({ seed: 9, teamId: "gulls" });
  const user = state.teams.find((t) => t.id === "gulls");
  const other = state.teams.find((t) => t.id !== "gulls");
  const prospect = state.players[other.farm[0]];
  state.inbox.push({
    id: "i-claim",
    resolved: false,
    kind: "claim",
    playerId: prospect.id,
    fee: 0.4,
    title: "Claim",
    body: "Available.",
  });
  const claimed = respondInbox(state, "i-claim", "accept");
  assert.equal(claimed.ok, true, claimed.message);
  assert.equal(prospect.teamId, "gulls");
  assert.ok(user.farm.includes(prospect.id) || user.active.includes(prospect.id));
  assert.match(state.news.find((n) => n.kind === "trade").body, /claim/);
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  const kid = state.players[user.farm.find((id) => state.players[id] && !state.players[id].isPitcher)];
  const worst = user.active.map((id) => state.players[id]).filter((p) => p && !p.isPitcher).sort((a, b) => a.contact - b.contact)[0];
  state.inbox.push({
    id: "i-up",
    resolved: false,
    kind: "callup",
    playerId: kid.id,
    replaceId: worst.id,
    title: "Up",
    body: "Knocking.",
  });
  const up = respondInbox(state, "i-up", "accept");
  assert.equal(up.ok, true, up.message);
  assert.ok(user.active.includes(kid.id));
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  delete state.focus;
  const back = hydrate(serialize(state));
  assert.deepEqual(back.focus, []);
  assert.ok(Array.isArray(back.awardsLog));
});

test("one series can leave a desk note without breaking the roster", () => {
  const state = createCareer({ seed: 21, teamId: "gulls", situation: "contender" });
  assert.equal(openSeason(state).ok, true);
  const week = simWeek(state);
  assert.equal(week.ok, true, week.message);
  for (const item of state.inbox) {
    assert.ok(item.title && item.body);
    if (item.kind === "claim") assert.equal(state.players[item.playerId].teamId !== "gulls", true);
    if (item.kind === "callup") assert.equal(state.players[item.playerId].teamId, "gulls");
  }
  assert.equal(audit(state).length, 0, audit(state).join("; "));
});
