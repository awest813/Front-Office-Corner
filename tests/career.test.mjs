import assert from "node:assert/strict";
import test from "node:test";
import {
  audit,
  createCareer,
  hydrate,
  marketSalary,
  markManualRead,
  offerExtension,
  releasePlayer,
  retireGm,
  serialize,
  simSeasonToRecap,
  submitTrade,
  takeToasts,
  tradePreview,
} from "../js/career.js";
import { surplusValue } from "../js/roster.js";

function acceptableDeal(state) {
  const user = state.teams.find((t) => t.id === state.userTeamId);
  const mine = [...user.active, ...user.farm].map((id) => state.players[id]).filter(Boolean);
  let chosen = null;
  for (const them of state.teams) {
    if (them.id === user.id) continue;
    const theirs = [...them.active, ...them.farm].map((id) => state.players[id]).filter(Boolean);
    for (const give of mine) {
      for (const take of theirs) {
        const preview = tradePreview(state, them.id, [give.id], [take.id], 0, 0);
        if (!preview.ok || preview.edge < 1.5) continue;
        if (!chosen || preview.edge < chosen.edge) {
          chosen = { theirId: them.id, sendIds: [give.id], recvIds: [take.id], cash: 0, edge: preview.edge };
        }
      }
    }
  }
  if (chosen) return chosen;
  const give = mine.slice().sort((a, b) => surplusValue(b) - surplusValue(a))[0];
  for (const them of state.teams) {
    if (them.id === user.id) continue;
    const take = [...them.active, ...them.farm]
      .map((id) => state.players[id])
      .filter(Boolean)
      .sort((a, b) => surplusValue(a) - surplusValue(b))[0];
    if (!give || !take) continue;
    for (let cash = 0; cash <= 12; cash += 1) {
      const preview = tradePreview(state, them.id, [give.id], [take.id], cash, 0);
      if (preview.ok && preview.edge >= 1.5) {
        return { theirId: them.id, sendIds: [give.id], recvIds: [take.id], cash, edge: preview.edge };
      }
    }
  }
  return null;
}

test("a user career can trade, release, extend, finish a year, and retire", () => {
  const state = createCareer({
    seed: 7,
    teamId: "gulls",
    gmName: "Casey Quinn",
    difficulty: "lenient",
    situation: "contender",
  });
  assert.equal(state.cpu, false);
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  markManualRead(state);
  const trophies = takeToasts(state);
  const manual = trophies.find((item) => item && item.id === "manual");
  assert.ok(manual, "manual trophy missing");
  assert.equal(manual.name, "Read the Manual");
  assert.deepEqual(state.pendingToasts, []);

  const deal = acceptableDeal(state);
  assert.ok(deal, "no trade the other club would accept");
  const traded = submitTrade(state, deal.theirId, deal.sendIds, deal.recvIds, deal.cash, 0);
  assert.equal(traded.ok, true, traded.message);
  assert.equal(state.players[deal.recvIds[0]].teamId, state.userTeamId);
  assert.equal(state.players[deal.sendIds[0]].teamId, deal.theirId);
  const wire = state.news.find((item) => item.kind === "trade");
  assert.match(wire.body, / sends /);
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  const team = state.teams.find((t) => t.id === state.userTeamId);
  const farm = team.farm.map((id) => state.players[id]);
  const victim = farm.find((p) => !p.isPitcher) || farm.find((p) => p.isPitcher);
  assert.ok(victim, "farm empty");
  const released = releasePlayer(state, victim.id);
  assert.equal(released.ok, true, released.message);
  assert.equal(state.players[victim.id].teamId, null);
  assert.equal(audit(state).length, 0, audit(state).join("; "));

  const stayId = team.active.find((id) => state.players[id] && !state.players[id].isPitcher && id !== victim.id);
  const stay = state.players[stayId];
  const extended = offerExtension(state, stay.id, 4, Math.max(marketSalary(stay) * 1.4, 8));
  assert.equal(extended.ok, true, extended.message);
  assert.equal(stay.contract.type, "extension");
  assert.equal(stay.contract.years, 4);

  simSeasonToRecap(state);
  assert.ok(["recap", "legacy"].includes(state.phase), state.phase);
  assert.equal(audit(state).length, 0, audit(state).join("; "));
  if (state.phase === "recap") {
    for (const club of state.teams) assert.equal(club.wins + club.losses, 56, club.id);
    const retired = retireGm(state);
    assert.equal(retired.ok, true, retired.message);
  } else {
    assert.equal(state.gm.fired, true);
    assert.equal(retireGm(state).ok, false);
  }
  assert.equal(state.phase, "legacy");

  const back = hydrate(serialize(state));
  assert.equal(back.version, state.version);
  assert.equal(back.cpu, false);
  assert.equal(back.userTeamId, "gulls");
  assert.equal(back.gm.name, "Casey Quinn");
  assert.equal(back.phase, "legacy");
  assert.equal(back.players[deal.recvIds[0]].teamId, "gulls");
  assert.equal(back.achievements.manual.year, 2026);
  assert.equal(audit(back).length, 0, audit(back).join("; "));
});
