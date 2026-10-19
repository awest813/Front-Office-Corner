import { defenseRating, relieverOuts, starterInnings } from "./roster.js";
import { clamp } from "./util.js";

export const TUNING = {
  kBase: 0.188,
  kEye: 0.27,
  kContact: 0.04,
  bbBase: 0.084,
  bbEye: 0.18,
  hbp: 0.01,
  hrBase: 0.042,
  hrPower: 0.09,
  outBase: 0.688,
  outDef: 0.15,
  outSpeed: 0.08,
};

function live(p, key, bonus = 0) {
  const swing = Math.round(((p.morale || 55) - 55) / 28 * 3);
  return clamp((p[key] || 40) + swing + bonus, 20, 80);
}

function seriesFocus(state) {
  if (!state?.plan || state.cpu || state.plan.week !== state.week) return "";
  return state.plan.focus || "";
}

function planBonus(state, player, key) {
  const focus = seriesFocus(state);
  if (!focus || !player || player.teamId !== state.userTeamId) return 0;
  if (focus === "bats" && (key === "contact" || key === "power")) return 2;
  if (focus === "arms" && (key === "stuff" || key === "control")) return 2;
  return 0;
}

function n(grade) {
  return clamp((grade - 20) / 60, 0, 1);
}

function addBat(p, key, amt = 1) {
  p.season.bat[key] += amt;
  p.career.bat[key] += amt;
}

function addPit(p, key, amt = 1) {
  p.season.pit[key] += amt;
  p.career.pit[key] += amt;
}

function plate(rng, batter, pitcher, def, park, bonus = () => 0) {
  const c = n(live(batter, "contact", bonus(batter, "contact")));
  const pw = n(live(batter, "power", bonus(batter, "power")));
  const ey = n(live(batter, "eye", bonus(batter, "eye")));
  const sp = n(batter.speed);
  const st = n(live(pitcher, "stuff", bonus(pitcher, "stuff")));
  const ct = n(live(pitcher, "control", bonus(pitcher, "control")));
  const mv = n(live(pitcher, "movement", bonus(pitcher, "movement")));
  let k = TUNING.kBase + (st - ey) * TUNING.kEye + (st - c) * TUNING.kContact;
  let bb = TUNING.bbBase + (ey - ct) * TUNING.bbEye + (0.5 - ct) * 0.05;
  k = clamp(k, 0.07, 0.40);
  bb = clamp(bb, 0.03, 0.16);
  const hbp = TUNING.hbp;
  const roll = rng.next();
  if (roll < k) return "K";
  if (roll < k + bb) return "BB";
  if (roll < k + bb + hbp) return "HBP";
  const hr = clamp(TUNING.hrBase + (pw - mv) * TUNING.hrPower + (park - 1) * 0.045, 0.004, 0.12);
  const bip = rng.next();
  if (bip < hr) return "HR";
  const outP = clamp(
    TUNING.outBase + (def - 0.5) * TUNING.outDef - (sp - 0.5) * TUNING.outSpeed - (c - 0.5) * 0.05 + (mv - 0.5) * 0.04,
    0.56,
    0.84,
  );
  if (bip < hr + (1 - hr) * outP) {
    if (rng.chance(clamp(0.018 - (def - 0.5) * 0.02, 0.006, 0.035))) return "E";
    return rng.chance(0.36) ? "OUT_FLY" : "OUT_GB";
  }
  const xbh = clamp(0.3 + (pw - 0.5) * 0.26 + (sp - 0.5) * 0.06, 0.12, 0.48);
  const r2 = rng.next();
  if (r2 < xbh * 0.08 && sp > 0.62) return "3B";
  if (r2 < xbh) return "2B";
  return "1B";
}

function emptyBases() {
  return [null, null, null];
}

function applyPlay(bases, batter, type, rng) {
  const scored = [];
  let rbi = 0;
  let outsAdded = 0;
  const speed = n(batter.speed);
  const scoreFrom = (i, credit) => {
    if (!bases[i]) return;
    scored.push(bases[i]);
    if (credit) rbi += 1;
    bases[i] = null;
  };
  if (type === "HR") {
    scoreFrom(2, true);
    scoreFrom(1, true);
    scoreFrom(0, true);
    scored.push(batter.id);
    rbi += 1;
    return { scored, rbi, outsAdded };
  }
  if (type === "3B") {
    scoreFrom(2, true);
    scoreFrom(1, true);
    scoreFrom(0, true);
    bases[2] = batter.id;
    return { scored, rbi, outsAdded };
  }
  if (type === "2B") {
    scoreFrom(2, true);
    scoreFrom(1, true);
    if (bases[0]) {
      if (speed > 0.62 && rng.chance(0.4)) {
        scored.push(bases[0]);
        rbi += 1;
        bases[0] = null;
      } else {
        bases[2] = bases[0];
        bases[0] = null;
      }
    }
    bases[1] = batter.id;
    return { scored, rbi, outsAdded };
  }
  if (type === "1B") {
    scoreFrom(2, true);
    if (bases[1]) {
      if (rng.chance(0.58 + speed * 0.2)) scoreFrom(1, true);
      else {
        bases[2] = bases[1];
        bases[1] = null;
      }
    }
    if (bases[0]) {
      if (!bases[1] && !bases[2] && speed > 0.64 && rng.chance(0.28)) bases[2] = bases[0];
      else if (!bases[1]) bases[1] = bases[0];
      else bases[1] = bases[0];
      bases[0] = null;
    }
    bases[0] = batter.id;
    return { scored, rbi, outsAdded };
  }
  if (type === "BB" || type === "HBP") {
    if (bases[0] && bases[1] && bases[2]) {
      scoreFrom(2, true);
      bases[2] = bases[1];
      bases[1] = bases[0];
      bases[0] = batter.id;
    } else if (bases[0] && bases[1]) {
      bases[2] = bases[1];
      bases[1] = bases[0];
      bases[0] = batter.id;
    } else if (bases[0]) {
      bases[1] = bases[0];
      bases[0] = batter.id;
    } else {
      bases[0] = batter.id;
    }
    return { scored, rbi, outsAdded };
  }
  if (type === "E") {
    scoreFrom(2, false);
    if (bases[1]) {
      bases[2] = bases[1];
      bases[1] = null;
    }
    if (bases[0]) {
      if (!bases[1]) bases[1] = bases[0];
      bases[0] = null;
    }
    bases[0] = batter.id;
    return { scored, rbi, outsAdded };
  }
  outsAdded = 1;
  return { scored, rbi, outsAdded, type };
}

function buildStaff(state, team) {
  const healthy = (id) => {
    const p = state.players[id];
    return p && !p.injuredWeeks && !p.retired ? p : null;
  };
  const rotation = team.rotation.map(healthy).filter(Boolean);
  let starter = null;
  if (rotation.length) {
    const idx = team.rotationTurn % team.rotation.length;
    team.rotationTurn = (team.rotationTurn + 1) % team.rotation.length;
    starter = healthy(team.rotation[idx]) || rotation[0];
  }
  const pen = team.active
    .map((id) => state.players[id])
    .filter((p) => p && p.isPitcher && !p.injuredWeeks && (!starter || p.id !== starter.id))
    .sort((a, b) => b.stuff - a.stuff);
  if (!starter) starter = pen.shift() || team.active.map((id) => state.players[id]).find((p) => p && p.isPitcher);
  const closer = pen[0] || null;
  const setup = pen[1] || null;
  const middle = pen.slice(closer ? 2 : 0);
  return {
    starter,
    closer,
    setup,
    middle: middle.slice(),
    used: [],
    current: null,
    firstReliever: null,
  };
}

function armState(player, starter) {
  const limit = starter ? Math.round(starterInnings(player) * 3) : relieverOuts(player);
  return { player, outingOuts: 0, runs: 0, limit, started: !!starter };
}

function nextArm(staff, inning, lead) {
  if (!staff.current) return armState(staff.starter, true);
  const cur = staff.current;
  if (!staff.used.find((a) => a.player.id === cur.player.id)) staff.used.push(cur);
  const take = (p) => {
    if (!p) return null;
    if (staff.used.some((a) => a.player.id === p.id) && staff.middle.length) return null;
    return armState(p, false);
  };
  if (inning >= 8 && lead > 0 && lead <= 3) {
    const c = take(staff.closer);
    if (c) return c;
  }
  if (inning >= 7 && lead > 0 && lead <= 2) {
    const s = take(staff.setup);
    if (s) return s;
  }
  if (staff.middle.length) return armState(staff.middle.shift(), false);
  if (staff.setup && !staff.used.some((a) => a.player.id === staff.setup.id)) return armState(staff.setup, false);
  if (staff.closer && !staff.used.some((a) => a.player.id === staff.closer.id)) return armState(staff.closer, false);
  return cur;
}

function hook(staff, inning, lead) {
  const cur = staff.current;
  if (!cur) {
    staff.current = nextArm(staff, inning, lead);
    return;
  }
  const starterDone = cur.started && (cur.outingOuts >= cur.limit || (cur.runs >= 5 && cur.outingOuts >= 12 && inning >= 5));
  const penDone = !cur.started && cur.outingOuts >= cur.limit;
  if (starterDone || penDone) {
    const nxt = nextArm(staff, inning, lead);
    if (nxt && nxt.player.id !== cur.player.id) {
      if (!staff.firstReliever && cur.started) staff.firstReliever = nxt;
      staff.current = nxt;
    }
  }
}

export function simulateGame(state, rng, homeId, awayId, opts = {}) {
  const home = state.teams.find((t) => t.id === homeId);
  const away = state.teams.find((t) => t.id === awayId);
  const log = !!opts.log;
  const homeOrder = home.lineup.map((s) => ({ player: state.players[s.id], pos: s.pos }));
  const awayOrder = away.lineup.map((s) => ({ player: state.players[s.id], pos: s.pos }));
  const homeStaff = buildStaff(state, home);
  const awayStaff = buildStaff(state, away);
  homeStaff.current = armState(homeStaff.starter, true);
  awayStaff.current = armState(awayStaff.starter, true);
  let homeDef = defenseRating(state, home);
  let awayDef = defenseRating(state, away);
  if (seriesFocus(state) === "gloves") {
    if (home.id === state.userTeamId) homeDef = clamp(homeDef + 0.045, 0.05, 0.95);
    if (away.id === state.userTeamId) awayDef = clamp(awayDef + 0.045, 0.05, 0.95);
  }
  const bonus = (player, key) => planBonus(state, player, key);
  const park = home.park || 1;
  let homeScore = 0;
  let awayScore = 0;
  let homeHits = 0;
  let awayHits = 0;
  let homeErr = 0;
  let awayErr = 0;
  let homeWalks = 0;
  let awayWalks = 0;
  const homeInn = [];
  const awayInn = [];
  const notes = [];
  const hrs = [];
  const hitTypes = new Map();
  const appearedBat = new Set();
  const appearedPit = new Set();
  let winP = null;
  let lossP = null;
  let walkoff = false;
  let inning = 1;
  const index = { home: 0, away: 0 };
  const note = (text) => {
    if (log && notes.length < 28) notes.push(text);
  };

  function creditRunners(ids) {
    for (const id of ids) {
      const p = state.players[id];
      if (p) addBat(p, "r", 1);
    }
  }

  function offenseStaff(side) {
    return side === "home" ? homeStaff : awayStaff;
  }
  function defenseStaff(side) {
    return side === "home" ? awayStaff : homeStaff;
  }

  function playHalf(side) {
    const order = side === "home" ? homeOrder : awayOrder;
    const def = side === "home" ? awayDef : homeDef;
    const staff = defenseStaff(side);
    let outs = 0;
    let pas = 0;
    const bases = emptyBases();
    let runs = 0;
    const catcher = (side === "home" ? away.lineup : home.lineup).find((s) => s.pos === "C");
    const catcherArm = catcher ? n(state.players[catcher.id]?.arm || 50) : 0.5;
    while (outs < 3 && pas < 48) {
      pas += 1;
      const leadForPitcher = side === "home" ? awayScore - homeScore : homeScore - awayScore;
      hook(staff, inning, leadForPitcher);
      const pit = staff.current;
      if (!appearedPit.has(pit.player.id)) {
        appearedPit.add(pit.player.id);
        addPit(pit.player, "g", 1);
        if (pit.started) addPit(pit.player, "gs", 1);
      }
      const slot = order[index[side] % order.length];
      const batter = slot.player;
      if (bases[0] && !bases[1] && n(batter.speed) > 0.6 && rng.chance(0.045 + n(state.players[bases[0]].speed) * 0.05)) {
        const runner = state.players[bases[0]];
        const ok = rng.chance(0.64 + n(runner.speed) * 0.18 - catcherArm * 0.12);
        if (ok) {
          addBat(runner, "sb", 1);
          bases[1] = bases[0];
          bases[0] = null;
        } else {
          addBat(runner, "cs", 1);
          bases[0] = null;
          outs += 1;
          pit.outingOuts += 1;
          addPit(pit.player, "outs", 1);
          if (outs >= 3) break;
        }
      }
      index[side] += 1;
      if (!appearedBat.has(batter.id)) {
        appearedBat.add(batter.id);
        addBat(batter, "g", 1);
      }
      const beforeH = homeScore;
      const beforeA = awayScore;
      let type = plate(rng, batter, pit.player, def, park, bonus);
      addBat(batter, "pa", 1);
      if (type === "K") {
        addBat(batter, "ab", 1);
        addBat(batter, "k", 1);
        addPit(pit.player, "k", 1);
        outs += 1;
        pit.outingOuts += 1;
        addPit(pit.player, "outs", 1);
      } else if (type === "OUT_FLY" && bases[2] && outs < 2) {
        addBat(batter, "ab", 1);
        const runner = bases[2];
        bases[2] = null;
        creditRunners([runner]);
        addBat(batter, "rbi", 1);
        runs += 1;
        if (side === "home") homeScore += 1;
        else awayScore += 1;
        pit.runs += 1;
        addPit(pit.player, "er", 1);
        addPit(pit.player, "r", 1);
        outs += 1;
        pit.outingOuts += 1;
        addPit(pit.player, "outs", 1);
        note(`${inning}: ${batter.last} sac fly, a run scores`);
      } else if ((type === "OUT_GB" || type === "OUT_FLY") && type === "OUT_GB" && bases[0] && outs < 2 && rng.chance(0.1)) {
        addBat(batter, "ab", 1);
        bases[0] = null;
        outs += 2;
        pit.outingOuts += 2;
        addPit(pit.player, "outs", 2);
      } else if (type === "OUT_GB" || type === "OUT_FLY") {
        addBat(batter, "ab", 1);
        outs += 1;
        pit.outingOuts += 1;
        addPit(pit.player, "outs", 1);
      } else {
        const result = applyPlay(bases, batter, type, rng);
        if (type === "BB") {
          addBat(batter, "bb", 1);
          addPit(pit.player, "bb", 1);
          if (side === "home") homeWalks += 1;
          else awayWalks += 1;
        } else if (type === "HBP") {
          addBat(batter, "hbp", 1);
          addPit(pit.player, "hbp", 1);
          if (side === "home") homeWalks += 1;
          else awayWalks += 1;
        } else if (type === "E") {
          addBat(batter, "ab", 1);
          if (side === "home") awayErr += 1;
          else homeErr += 1;
        } else {
          addBat(batter, "ab", 1);
          addBat(batter, "h", 1);
          if (type === "2B") addBat(batter, "d", 1);
          if (type === "3B") addBat(batter, "t", 1);
          if (type === "HR") {
            addBat(batter, "hr", 1);
            addPit(pit.player, "hr", 1);
            hrs.push({ id: batter.id, inning, side });
          }
          addPit(pit.player, "h", 1);
          if (side === "home") homeHits += 1;
          else awayHits += 1;
          if (log) {
            if (!hitTypes.has(batter.id)) hitTypes.set(batter.id, new Set());
            hitTypes.get(batter.id).add(type);
          }
        }
        if (result.rbi) addBat(batter, "rbi", result.rbi);
        if (result.scored.length) {
          creditRunners(result.scored);
          const earned = type !== "E";
          runs += result.scored.length;
          if (side === "home") homeScore += result.scored.length;
          else awayScore += result.scored.length;
          pit.runs += result.scored.length;
          addPit(pit.player, "r", result.scored.length);
          if (earned) addPit(pit.player, "er", result.scored.length);
          if (type === "HR") note(`${inning}: ${batter.last} homers (${result.scored.length} RBI)`);
          else if (result.scored.length) note(`${inning}: ${batter.last} ${type === "1B" ? "singles" : type === "2B" ? "doubles" : type === "3B" ? "triples" : "reaches"}, ${result.scored.length} score`);
        }
        if (outs < 3 && result.outsAdded) {
          const add = Math.min(result.outsAdded, 3 - outs);
          outs += add;
          pit.outingOuts += add;
          addPit(pit.player, "outs", add);
        }
      }
      const prevLeader = beforeH === beforeA ? "tie" : beforeH > beforeA ? "home" : "away";
      const leader = homeScore === awayScore ? "tie" : homeScore > awayScore ? "home" : "away";
      if (leader !== "tie" && leader !== prevLeader && leader === side) {
        winP = offenseStaff(side).current;
        lossP = staff.current;
      } else if (leader === "tie") {
        winP = null;
        lossP = null;
      }
      if (side === "home" && inning >= 9 && homeScore > awayScore) {
        walkoff = true;
        break;
      }
    }
    return runs;
  }

  while (inning <= 15) {
    awayInn.push(playHalf("away"));
    if (inning >= 9 && homeScore > awayScore) break;
    homeInn.push(playHalf("home"));
    if (walkoff) break;
    if (inning >= 9 && homeScore !== awayScore) break;
    inning += 1;
    if (inning > 15 && homeScore === awayScore) {
      const slot = homeOrder[index.home % homeOrder.length];
      homeScore += 1;
      homeHits += 1;
      addBat(slot.player, "h", 1);
      addBat(slot.player, "ab", 1);
      addBat(slot.player, "pa", 1);
      addBat(slot.player, "r", 1);
      addBat(slot.player, "rbi", 1);
      if (homeInn.length) homeInn[homeInn.length - 1] += 1;
      walkoff = true;
      winP = homeStaff.current;
      lossP = awayStaff.current;
      note(`${inning - 1}: ${slot.player.last} ends it`);
      break;
    }
  }

  const homeWins = homeScore > awayScore;
  const winner = homeWins ? homeId : awayId;
  const loser = homeWins ? awayId : homeId;
  let wp = winP;
  let lp = lossP;
  const winStaff = homeWins ? homeStaff : awayStaff;
  if (wp && wp.started && wp.outingOuts < 15 && winStaff.firstReliever) wp = winStaff.firstReliever;
  if (!wp) wp = winStaff.current;
  if (!lp) lp = (homeWins ? awayStaff : homeStaff).current;
  if (wp?.player) addPit(wp.player, "w", 1);
  if (lp?.player && lp.player.id !== wp?.player?.id) addPit(lp.player, "l", 1);
  const finisher = winStaff.current;
  const lead = Math.abs(homeScore - awayScore);
  let sv = null;
  if (finisher && wp && finisher.player.id !== wp.player.id && lead <= 3 && finisher.outingOuts >= 3) {
    sv = finisher.player;
    addPit(sv, "sv", 1);
  }

  const loserHits = homeWins ? awayHits : homeHits;
  const loserWalks = homeWins ? awayWalks : homeWalks;
  const loserErr = homeWins ? awayErr : homeErr;
  const loserOuts = (homeWins ? awayStaff : homeStaff).used.concat([(homeWins ? awayStaff : homeStaff).current])
    .reduce((s, a) => s + (a?.outingOuts || 0), 0);
  const noHitter = loserHits === 0 && loserOuts >= 27 ? winner : null;
  const perfect = noHitter && loserWalks === 0 && loserErr === 0 ? winner : null;

  let cycle = null;
  if (log) {
    for (const [id, set] of hitTypes) {
      if (set.has("1B") && set.has("2B") && set.has("3B") && set.has("HR")) cycle = id;
    }
  }

  return {
    homeId,
    awayId,
    homeInnings: homeInn,
    awayInnings: awayInn,
    homeRuns: homeScore,
    awayRuns: awayScore,
    homeHits,
    awayHits,
    homeErrors: homeErr,
    awayErrors: awayErr,
    winner,
    loser,
    wp: wp?.player?.id || null,
    lp: lp?.player?.id || null,
    sv: sv?.id || null,
    hrs,
    notes,
    noHitter,
    perfect,
    walkoff,
    cycle,
  };
}
