import assert from "node:assert/strict";
import test from "node:test";
import {
  audit,
  buildSchedule,
  completeCpuYear,
  createCareer,
  leagueReport,
  profit,
  serialize,
  hydrate,
  simSeasonToRecap,
  standings,
} from "../js/career.js";
import { TEAMS } from "../js/data.js";

function scheduleHealth(schedule) {
  const errors = [];
  assert.equal(schedule.length, 14);
  const games = {};
  const home = {};
  for (const id of TEAMS.map((t) => t.id)) {
    games[id] = 0;
    home[id] = 0;
  }
  schedule.forEach((week, w) => {
    assert.equal(week.length, 12, `week ${w} games`);
    const seen = new Set();
    for (const g of week) {
      assert.notEqual(g.home, g.away);
      assert.equal(seen.has(g.home), false, `${g.home} double booked week ${w}`);
      assert.equal(seen.has(g.away), false, `${g.away} double booked week ${w}`);
      seen.add(g.home);
      seen.add(g.away);
      games[g.home] += 4;
      games[g.away] += 4;
      home[g.home] += 4;
    }
  });
  for (const id of Object.keys(games)) {
    if (games[id] !== 56) errors.push(`${id} played ${games[id]}`);
    if (home[id] < 20 || home[id] > 36) errors.push(`${id} home ${home[id]}`);
  }
  return errors;
}

test("schedule is a full 56-game slate", () => {
  const teams = TEAMS.map((t) => ({ id: t.id, league: t.league, division: t.division }));
  const errors = scheduleHealth(buildSchedule(teams));
  assert.deepEqual(errors, []);
});

test("a career can be created and audited", () => {
  const state = createCareer({ seed: 7, teamId: "gulls", gmName: "Jordan Hale", cpu: true });
  assert.equal(audit(state).length, 0, audit(state).join("; "));
  assert.equal(state.teams.length, 24);
  assert.ok(Object.keys(state.players).length > 700);
  assert.equal(state.phase, "preseason");
  assert.equal(standings(state).length, 2);
});

test("one season finishes with sane baseball", () => {
  const state = createCareer({ seed: 11, teamId: "express", situation: "contender", cpu: true });
  simSeasonToRecap(state);
  const errors = audit(state);
  assert.deepEqual(errors, []);
  const report = leagueReport(state);
  assert.ok(report.avg > 0.23 && report.avg < 0.29, `avg ${report.avg}`);
  assert.ok(report.rpg > 3.4 && report.rpg < 5.6, `rpg ${report.rpg}`);
  assert.ok(report.era > 3.2 && report.era < 5.8, `era ${report.era}`);
  for (const team of state.teams) {
    assert.equal(team.wins + team.losses, 56, team.id);
  }
  const wins = state.teams.reduce((s, t) => s + t.wins, 0);
  assert.equal(wins, 24 * 56 / 2);
  assert.ok(["recap", "legacy"].includes(state.phase));
  assert.ok(state.champions.length === 1);
  console.log("season", {
    avg: report.avg.toFixed(3),
    rpg: report.rpg.toFixed(2),
    era: report.era.toFixed(2),
    hr: report.hr,
    phase: state.phase,
    user: `${state.teams.find((t) => t.id === state.userTeamId).wins}-${state.teams.find((t) => t.id === state.userTeamId).losses}`,
  });
});

test("three winters leave the league intact", () => {
  const state = createCareer({ seed: 21, teamId: "firs", situation: "rebuild", difficulty: "lenient", cpu: true });
  for (let i = 0; i < 3; i++) completeCpuYear(state);
  const errors = audit(state);
  assert.deepEqual(errors, [], errors.join("; "));
  assert.equal(state.gm.fired, false);
  assert.ok(state.year >= 2028);
  const count = Object.values(state.players).filter((p) => !p.retired && p.teamId).length;
  assert.ok(count > 700 && count < 1600, `rostered ${count}`);
  assert.ok(Number.isFinite(profit(state)));
});

test("saves round-trip", () => {
  const state = createCareer({ seed: 3, teamId: "fog", cpu: true });
  const again = hydrate(serialize(state));
  assert.equal(again.seed, 3);
  assert.equal(again.userTeamId, "fog");
  assert.equal(audit(again).length, 0);
});
