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
  seriesBrief,
  rosterBoard,
  setPosture,
  autoSetLineup,
  autoSetRotation,
  setFocus,
  setPlan,
  simDay,
  simWeek,
  weekAgenda,
  clubhouse,
} from "../js/career.js";
import { playerReport, playerRole } from "../js/report.js";
import { crest, icon } from "../js/marks.js";
import { TEAMS } from "../js/data.js";

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

test("the series card uses the home park and opens the book when the fog lifts", () => {
  const state = createCareer({ seed: 11, teamId: "gulls", situation: "contender" });
  assert.equal(seriesBrief(state).opponentId !== "gulls", true);
  const early = seriesBrief(state);
  const gulls = state.teams.find((t) => t.id === "gulls");
  if (early.where === "Home") assert.equal(early.parkName, gulls.parkName);
  else assert.notEqual(early.parkName, gulls.parkName);
  assert.match(early.parkLine, /park/);
  assert.match(early.note, /book|Scouting/);
  if (early.fog >= 8) {
    assert.equal(early.arm, null);
    assert.equal(early.bat, null);
  }
  const opp = state.teams.find((t) => t.id === early.opponentId);
  for (const id of opp.active) state.players[id].scoutNoise = 0;
  const open = seriesBrief(state);
  assert.equal(open.note, "The book is open.");
  assert.equal(state.players[open.arm.id].isPitcher, true);
  assert.equal(state.players[open.bat.id].isPitcher, false);
  assert.match(open.arm.name, /\s/);
  const room = clubhouse(state);
  assert.match(room.line, /room/);
  for (const id of gulls.active) state.players[id].morale = 30;
  const sour = clubhouse(state);
  assert.match(sour.line, /restless/);
  assert.ok(sour.sour >= 3);
});

test("the series log keeps each score and the clubhouse names a voice", () => {
  const state = createCareer({ seed: 11, teamId: "gulls", situation: "contender" });
  const early = seriesBrief(state);
  assert.equal(early.games.length, 4);
  assert.equal(early.games.every((g) => !g.played), true);
  assert.equal(state.players[early.yours.id].isPitcher, true);
  assert.equal(state.players[early.yours.id].teamId, "gulls");
  const room = clubhouse(state);
  assert.ok(room.voices.length >= 1);
  assert.ok(room.voices.at(-1).name.includes(" "));

  assert.equal(openSeason(state).ok, true);
  const day = simDay(state);
  assert.equal(day.ok, true, day.message);
  const after = seriesBrief(state);
  assert.equal(after.games[0].played, true);
  assert.match(after.games[0].line, /^[WL] \d+–\d+$/);
  assert.equal(after.games[1].played, false);
  assert.equal(after.parkName, state.teams.find((t) => t.id === "gulls").parkName);
  assert.equal(state.players[after.yours.id].teamId, "gulls");

  const gulls = state.teams.find((t) => t.id === "gulls");
  for (const id of gulls.active) state.players[id].morale = 60;
  state.players[gulls.active[0]].morale = 20;
  const sour = clubhouse(state);
  assert.equal(sour.voices[0].id, gulls.active[0]);
  assert.equal(sour.voices[0].sour, true);
  assert.ok(sour.voices.some((v) => !v.sour));
});

test("a posture changes how the staff builds the card", () => {
  const state = createCareer({ seed: 11, teamId: "gulls", situation: "contender" });
  const board = rosterBoard(state);
  assert.equal(board.spots.length, 9);
  assert.match(board.line, /Thin|body/);
  assert.ok(weekAgenda(state).some((item) => item.id === "posture"));
  assert.equal(setPosture(state, "nope").ok, false);

  const team = state.teams.find((t) => t.id === "gulls");
  const bench = team.active.map((id) => state.players[id]).find((p) => !p.isPitcher && !team.lineup.some((slot) => slot.id === p.id));
  bench.age = 31;
  bench.contract.years = 1;
  bench.onBlock = false;
  const starter = state.players[team.lineup[0].id];
  starter.onBlock = false;
  const arm = state.players[team.rotation[0]];
  arm.age = 32;
  arm.contract.years = 1;
  arm.onBlock = false;
  assert.equal(setPosture(state, "shop").ok, true);
  assert.equal(bench.onBlock, true);
  assert.equal(starter.onBlock, false);
  assert.equal(arm.onBlock, false);
  assert.equal(weekAgenda(state).some((item) => item.id === "posture"), false);

  const hitters = team.active.map((id) => state.players[id]).filter((p) => !p.isPitcher);
  const older = hitters[0];
  const younger = hitters[1];
  for (const p of hitters) {
    if (p === older || p === younger) continue;
    p.defense = 30;
  }
  for (const key of ["contact", "power", "eye", "speed", "arm"]) {
    older[key] = 50;
    younger[key] = 50;
  }
  older.positions = ["LF"];
  younger.positions = ["LF"];
  older.pos = "LF";
  younger.pos = "LF";
  older.age = 34;
  younger.age = 22;
  older.defense = 62;
  younger.defense = 59;
  assert.equal(setPosture(state, "bridge").ok, true);
  assert.equal(autoSetLineup(state).ok, true);
  assert.equal(team.lineup.find((slot) => slot.pos === "LF").id, younger.id);
  assert.equal(setPosture(state, "push").ok, true);
  assert.equal(autoSetLineup(state).ok, true);
  assert.equal(team.lineup.find((slot) => slot.pos === "LF").id, older.id);

  const starters = team.active.map((id) => state.players[id]).filter((p) => p.isPitcher && p.role === "SP");
  const vet = starters[0];
  const kid = starters[1];
  for (const p of starters) {
    p.stuff = 40;
    p.control = 40;
    p.movement = 40;
    p.stamina = 40;
  }
  vet.age = 34;
  kid.age = 23;
  vet.stuff = 70;
  kid.stuff = 68;
  assert.equal(setPosture(state, "bridge").ok, true);
  assert.equal(autoSetRotation(state).ok, true);
  assert.equal(team.rotation[0], kid.id);

  assert.equal(openSeason(state).ok, true);
  assert.equal(setPosture(state, "shop").ok, false);
  const raw = JSON.parse(serialize(state));
  delete raw.posture;
  assert.equal(hydrate(raw).posture, null);
  assert.equal(audit(state).length, 0, audit(state).join("; "));
});

test("your game keeps a play-by-play and the rest of the slate does not", () => {
  const state = createCareer({ seed: 11, teamId: "gulls", situation: "contender" });
  assert.equal(openSeason(state).ok, true);
  const day = simDay(state);
  assert.equal(day.ok, true, day.message);
  const box = state.lastBox;
  assert.ok(box.plays.length >= 24, `plays ${box.plays.length}`);
  for (const play of box.plays) {
    assert.ok(play.inning >= 1);
    assert.ok(play.half === "Top" || play.half === "Bot");
    assert.ok(play.text.length > 3);
    assert.match(play.score, /^\d+–\d+$/);
  }
  assert.ok(box.plays.some((play) => /strikes out|grounds out|flies out|walks|singles|doubles|homers/.test(play.text)));
  assert.equal(box.plays.at(-1).score, `${box.awayRuns}–${box.homeRuns}`);
  const other = state.schedule[0].find((game) => game.home !== "gulls" && game.away !== "gulls");
  const quiet = other.results.find(Boolean);
  assert.ok(quiet);
  assert.equal(quiet.plays, undefined);
  assert.equal(audit(state).length, 0, audit(state).join("; "));
});

test("every club has a mark and the desk icons draw", () => {
  for (const team of TEAMS) {
    const mark = crest(team.id);
    assert.ok(mark.includes("currentColor"), team.id);
    assert.ok(mark.length > 20, team.id);
  }
  for (const name of ["desk", "roster", "standings", "scores", "wire", "market", "books", "leaders", "october", "trophies", "bats", "arms", "gloves", "rest", "room"]) {
    assert.match(icon(name), /<svg/);
  }
});

test("the week list and the series plan", () => {
  const state = createCareer({ seed: 3, teamId: "gulls" });
  const agenda = weekAgenda(state);
  assert.ok(agenda.some((item) => item.id === "inbox" || item.id === "slate"));
  assert.equal(setPlan(state, "bats").ok, false);

  assert.equal(openSeason(state).ok, true);
  assert.ok(weekAgenda(state).some((item) => item.id === "plan"));
  const team = state.teams.find((t) => t.id === "gulls");
  const batter = state.players[team.lineup[0].id];
  const contact = batter.contact;
  const power = batter.power;
  assert.equal(setPlan(state, "bats").ok, true);
  assert.equal(state.plan.focus, "bats");
  assert.equal(setPlan(state, "nope").ok, false);
  assert.equal(weekAgenda(state).some((item) => item.id === "plan"), false);

  const day = simDay(state);
  assert.equal(day.ok, true, day.message);
  assert.equal(batter.contact, contact);
  assert.equal(batter.power, power);
  assert.equal(setPlan(state, "rest").ok, false);
  state.players[team.lineup[0].id].injuredWeeks = 2;
  assert.ok(weekAgenda(state).some((item) => item.id === "hurt"));
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  const raw = JSON.parse(serialize(state));
  delete raw.plan;
  const back = hydrate(raw);
  assert.equal(back.plan, null);

  const bats = createCareer({ seed: 8, teamId: "express", cpu: true });
  const gloves = createCareer({ seed: 8, teamId: "express", cpu: true });
  assert.equal(openSeason(bats).ok, true);
  assert.equal(openSeason(gloves).ok, true);
  bats.plan = { week: 0, focus: "bats" };
  gloves.plan = { week: 0, focus: "gloves" };
  assert.equal(simWeek(bats).ok, true);
  assert.equal(simWeek(gloves).ok, true);
  const left = bats.teams.find((t) => t.id === "express");
  const right = gloves.teams.find((t) => t.id === "express");
  assert.equal(left.wins, right.wins);
  assert.equal(left.rs, right.rs);
  assert.equal(left.ra, right.ra);
  assert.equal(audit(bats).length, 0, audit(bats).join("; "));
});
