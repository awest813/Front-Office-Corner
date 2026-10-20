import {
  ACTIVE_MAX,
  FIELD_POSITIONS,
  FIRST_NAMES,
  LAST_NAMES,
  MIN_SALARY,
  PERSONALITIES,
} from "./data.js";
import { clamp, fullName, hashStr, round1 } from "./util.js";

const WEIGHTS = {
  C: [0.2, 0.14, 0.16, 0.05, 0.32, 0.13],
  "1B": [0.28, 0.3, 0.2, 0.04, 0.12, 0.06],
  "2B": [0.22, 0.16, 0.16, 0.12, 0.24, 0.1],
  "3B": [0.22, 0.22, 0.16, 0.08, 0.2, 0.12],
  SS: [0.18, 0.12, 0.14, 0.12, 0.3, 0.14],
  LF: [0.24, 0.24, 0.16, 0.12, 0.16, 0.08],
  CF: [0.18, 0.14, 0.14, 0.18, 0.26, 0.1],
  RF: [0.22, 0.24, 0.16, 0.1, 0.16, 0.12],
  DH: [0.32, 0.34, 0.22, 0.08, 0.02, 0.02],
};

const FLEX = {
  C: ["C"],
  "1B": ["1B", "DH"],
  "2B": ["2B", "SS", "3B"],
  "3B": ["3B", "1B", "DH"],
  SS: ["SS", "2B", "3B"],
  LF: ["LF", "RF", "CF"],
  CF: ["CF", "LF", "RF"],
  RF: ["RF", "LF", "CF"],
  DH: ["DH", "1B"],
};

export function emptyBat() {
  return { g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, sb: 0, cs: 0, hbp: 0 };
}

export function emptyPit() {
  return { g: 0, gs: 0, outs: 0, h: 0, hr: 0, bb: 0, k: 0, er: 0, r: 0, w: 0, l: 0, sv: 0, hbp: 0 };
}

export function canPlay(p, pos) {
  if (p.isPitcher) return false;
  return p.positions.includes(pos);
}

export function overall(p) {
  if (!p) return 0;
  if (p.isPitcher) {
    return clamp(Math.round(p.stuff * 0.42 + p.control * 0.28 + p.movement * 0.22 + p.stamina * 0.08), 20, 80);
  }
  const w = WEIGHTS[p.pos] || WEIGHTS.LF;
  return clamp(Math.round(
    p.contact * w[0] + p.power * w[1] + p.eye * w[2] + p.speed * w[3] + p.defense * w[4] + p.arm * w[5],
  ), 20, 80);
}

export function talentWar(p) {
  const o = overall(p);
  if (p.isPitcher) return (o - 49) / 6.4;
  return (o - 48) / 6.1;
}

export function marketSalary(p) {
  const war = Math.max(0, talentWar(p));
  let aav = MIN_SALARY + Math.pow(war, 1.25) * 5.1;
  if (p.age >= 33) aav *= 0.78;
  if (p.age <= 23) aav *= 0.86;
  return round1(clamp(aav, MIN_SALARY, 40));
}

export function controlYears(p) {
  const left = Math.max(0, p.contract?.years || 0);
  if ((p.service || 0) >= 6) return left;
  return Math.max(left, 6 - (p.service || 0));
}

export function surplusValue(p) {
  if (!p || p.retired) return 0;
  const war = talentWar(p);
  const years = Math.max(1, Math.min(6, controlYears(p)));
  const aav = p.contract?.salary || MIN_SALARY;
  const market = Math.max(MIN_SALARY, Math.max(0, war) * 7.6);
  let v = (market - aav) * Math.min(years, 4) + war * 1.4;
  if (p.age <= 24) v += Math.max(0, (p.potential || 0) - overall(p)) * 0.32;
  if (p.age >= 34) v -= 1.6;
  if (p.onBlock) v *= 0.9;
  return v;
}

export function gradeLabel(g) {
  if (g >= 75) return "Elite";
  if (g >= 65) return "Plus";
  if (g >= 58) return "Above";
  if (g >= 48) return "Average";
  if (g >= 40) return "Fringe";
  return "Poor";
}

export function confidenceLabel(noise) {
  if (noise < 1.5) return "Complete";
  if (noise < 4) return "High";
  if (noise < 8) return "Medium";
  return "Low";
}

export function displayGrade(player, key, year, userTeamId) {
  const trueG = player[key];
  const own = player.teamId === userTeamId;
  const noise = own ? 0 : (player.scoutNoise ?? 10);
  if (noise < 1.5) return { value: trueG, exact: true, noise: 0 };
  const h = hashStr(`${player.id}:${key}:${year}`) / 4294967295;
  const delta = Math.round((h - 0.5) * 2 * noise);
  return { value: clamp(Math.round(trueG + delta), 20, 80), exact: false, noise };
}

export function starterInnings(p) {
  return 4.15 + ((p.stamina - 20) / 60) * 3.15;
}

export function relieverOuts(p) {
  return 3 + Math.round(((p.stamina - 20) / 60) * 3);
}

export function batScore(p) {
  return p.eye * 0.42 + p.contact * 0.36 + p.power * 0.22;
}

export function powerScore(p) {
  return p.power * 0.62 + p.contact * 0.24 + p.eye * 0.14;
}

function tuneToTarget(p, target) {
  const keys = p.isPitcher ? ["stuff", "control", "movement"] : ["contact", "power", "eye", "defense"];
  let guard = 0;
  while (guard++ < 16 && overall(p) < target - 1) {
    const key = keys[guard % keys.length];
    p[key] = clamp(p[key] + 1, 25, 80);
  }
  while (guard++ < 32 && overall(p) > target + 1) {
    const key = keys[guard % keys.length];
    p[key] = clamp(p[key] - 1, 25, 80);
  }
}

function targetsFor(rng, market, count, farm) {
  const targets = [];
  if (farm) {
    for (let i = 0; i < count; i++) targets.push(rng.intRange(34, 49));
    return targets;
  }
  const stars = market >= 1.22 ? 3 : market >= 1.0 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    if (i < stars) targets.push(rng.intRange(64, 73));
    else if (i < stars + 6) targets.push(rng.intRange(55, 63));
    else if (i < stars + 15) targets.push(rng.intRange(47, 56));
    else targets.push(rng.intRange(38, 48));
  }
  for (let i = targets.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = targets[i];
    targets[i] = targets[j];
    targets[j] = tmp;
  }
  return targets;
}

function pickName(rng, used) {
  for (let i = 0; i < 40; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const key = `${first} ${last}`;
    if (!used.has(key)) {
      used.add(key);
      return { first, last };
    }
  }
  const first = rng.pick(FIRST_NAMES);
  const last = `${rng.pick(LAST_NAMES)}`;
  const key = `${first} ${last} ${used.size}`;
  used.add(key);
  return { first, last: `${last}` };
}

function assignContract(rng, p, farm) {
  if (farm) {
    p.service = 0;
    p.contract = { years: 1, salary: MIN_SALARY, type: "prearb" };
    return;
  }
  const yearsIn = Math.max(0, p.age - 22);
  p.service = clamp(yearsIn + rng.intRange(-1, 1), 0, 12);
  const market = marketSalary(p);
  if (p.service < 3) {
    p.service = Math.min(p.service, 2);
    p.contract = { years: 1, salary: MIN_SALARY, type: "prearb" };
  } else if (p.service < 6) {
    const arb = round1(Math.max(MIN_SALARY, market * (0.28 + p.service * 0.09)));
    p.contract = { years: 1, salary: arb, type: "arb" };
  } else {
    const years = rng.intRange(1, p.age > 32 ? 2 : 4);
    p.contract = { years, salary: round1(market * rng.float(0.88, 1.12)), type: "fa" };
  }
}

export function createPlayer(rng, spec, used, idRef) {
  const pos = spec.pos;
  const isPitcher = pos === "SP" || pos === "RP";
  const name = pickName(rng, used);
  const target = spec.target ?? (spec.farm ? rng.intRange(36, 48) : rng.intRange(46, 58));
  const jitter = (bias = 0) => clamp(target + bias + rng.intRange(-7, 7), 28, 78);
  const id = `p${idRef.n++}`;
  const p = {
    id,
    first: name.first,
    last: name.last,
    age: spec.age,
    bats: rng.chance(0.12) ? "S" : rng.chance(0.28) ? "L" : "R",
    throws: rng.chance(0.28) ? "L" : "R",
    pos: isPitcher ? pos : pos,
    positions: isPitcher ? [] : [...new Set([pos, ...(FLEX[pos] || [])])],
    isPitcher,
    role: isPitcher ? pos : "POS",
    contact: isPitcher ? 20 : jitter(),
    power: isPitcher ? 20 : jitter(pos === "DH" || pos === "1B" ? 4 : -2),
    eye: isPitcher ? 20 : jitter(),
    speed: isPitcher ? 35 : jitter(pos === "CF" ? 4 : 0),
    defense: isPitcher ? 30 : jitter(pos === "DH" ? -14 : pos === "SS" || pos === "CF" ? 3 : 0),
    arm: isPitcher ? 40 : jitter(),
    stuff: isPitcher ? jitter(pos === "RP" ? 3 : 0) : 20,
    control: isPitcher ? jitter(-1) : 20,
    movement: isPitcher ? jitter() : 20,
    stamina: isPitcher ? clamp((pos === "SP" ? 58 : 42) + rng.intRange(-6, 6), 32, 76) : 40,
    durability: clamp(55 + rng.intRange(-10, 10), 32, 75),
    potential: 50,
    fragileWeeks: 0,
    injuredWeeks: 0,
    morale: rng.intRange(52, 72),
    personality: rng.pick(PERSONALITIES),
    service: 0,
    contract: { years: 1, salary: MIN_SALARY, type: "prearb" },
    season: { bat: emptyBat(), pit: emptyPit() },
    career: { bat: emptyBat(), pit: emptyPit() },
    scoutNoise: spec.noise ?? 0,
    teamId: spec.teamId,
    onBlock: false,
    retired: false,
    wasRookie: false,
    drafted: spec.drafted || null,
  };
  tuneToTarget(p, target);
  const o = overall(p);
  if (spec.farm) p.potential = clamp(o + rng.intRange(12, 32), 48, 80);
  else p.potential = clamp(Math.max(o, target) + rng.intRange(-4, 6), 36, 80);
  if (spec.farm && rng.chance(0.1)) p.potential = clamp(p.potential + rng.intRange(4, 10), 55, 80);
  assignContract(rng, p, !!spec.farm);
  return p;
}

const ACTIVE_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "C", "2B", "LF", "1B"];
const FARM_POS = ["C", "SS", "CF", "3B", "RF", "1B"];

export function stockTeam(rng, team, used, idRef, noise) {
  const players = [];
  const activeTargets = targetsFor(rng, team.market + (team.form || 0) / 20, 26, false);
  const farmTargets = targetsFor(rng, team.market, 10, true);
  let ai = 0;
  let fi = 0;
  const make = (pos, age, farm) => {
    const target = farm ? farmTargets[fi++] : activeTargets[ai++];
    const p = createPlayer(rng, {
      pos, age, farm, target, teamId: team.id, noise, drafted: null,
    }, used, idRef);
    p.scoutNoise = noise;
    players.push(p);
    return p;
  };
  const active = [];
  for (const pos of ACTIVE_POS) active.push(make(pos, rng.intRange(23, 33), false).id);
  for (let i = 0; i < 5; i++) active.push(make("SP", rng.intRange(23, 32), false).id);
  for (let i = 0; i < 8; i++) active.push(make("RP", rng.intRange(24, 33), false).id);
  const farm = [];
  for (const pos of FARM_POS) farm.push(make(pos, rng.intRange(18, 21), true).id);
  for (let i = 0; i < 2; i++) farm.push(make("SP", rng.intRange(18, 21), true).id);
  for (let i = 0; i < 2; i++) farm.push(make("RP", rng.intRange(19, 22), true).id);
  team.active = active;
  team.farm = farm;
  team.lineup = [];
  team.rotation = [];
  team.lineupCustom = false;
  team.rotationCustom = false;
  return players;
}

export function fitPayroll(state, team) {
  const target = team.budget * 0.93;
  let guard = 0;
  while (payrollOf(state, team) > target && guard++ < 30) {
    const adjustable = rosterPlayers(state, team)
      .filter((p) => team.active.includes(p.id) && p.contract && p.contract.salary > MIN_SALARY + 0.15)
      .sort((a, b) => b.contract.salary - a.contract.salary);
    if (!adjustable.length) break;
    let moved = false;
    for (const p of adjustable) {
      const floor = round1(Math.max(MIN_SALARY, marketSalary(p) * (p.contract.type === "fa" ? 0.7 : 0.88)));
      if (p.contract.salary <= floor + 0.05) continue;
      p.contract.salary = round1(Math.max(floor, p.contract.salary * 0.9));
      moved = true;
      break;
    }
    if (!moved) break;
  }
}

export function rosterPlayers(state, team) {
  return [...team.active, ...team.farm].map((id) => state.players[id]).filter(Boolean);
}

export function payrollOf(state, team) {
  let n = 0;
  for (const id of team.active) {
    const p = state.players[id];
    if (p) n += p.contract?.salary || 0;
  }
  for (const id of team.farm) {
    const p = state.players[id];
    if (p) n += Math.min(p.contract?.salary || 0, MIN_SALARY);
  }
  return n;
}

export function autoLineup(state, team, posture = "") {
  const available = team.active
    .map((id) => state.players[id])
    .filter((p) => p && !p.isPitcher && !p.injuredWeeks && !p.retired);
  const pool = available.length >= 9 ? available : rosterPlayers(state, team).filter((p) => !p.isPitcher && !p.retired);
  const orderPos = ["C", "SS", "CF", "2B", "3B", "RF", "LF", "1B", "DH"];
  const used = new Set();
  const chosen = [];
  const bridgePick = (cands, pos) => {
    if (posture !== "bridge" || cands.length < 2) return cands[0];
    const top = cands[0];
    const close = cands.filter((p) => {
      if (pos === "DH") return Math.abs(powerScore(top) - powerScore(p)) <= 4;
      return Math.abs(top.defense - p.defense) <= 3 && Math.abs(batScore(top) - batScore(p)) <= 4;
    });
    close.sort((a, b) => a.age - b.age || batScore(b) - batScore(a));
    return close[0];
  };
  for (const pos of orderPos) {
    let cands = pool.filter((p) => !used.has(p.id) && canPlay(p, pos));
    if (!cands.length) cands = pool.filter((p) => !used.has(p.id));
    if (!cands.length) break;
    cands.sort((a, b) => {
      if (pos === "DH") return powerScore(b) - powerScore(a);
      return (b.defense - a.defense) || (batScore(b) - batScore(a));
    });
    const pick = bridgePick(cands, pos);
    used.add(pick.id);
    chosen.push(pick);
    chosen[chosen.length - 1] = Object.assign(pick, { _pos: pos });
  }
  while (chosen.length < 9 && pool.some((p) => !used.has(p.id))) {
    const rest = pool.filter((p) => !used.has(p.id));
    rest.sort((a, b) => batScore(b) - batScore(a));
    const pick = bridgePick(rest, "DH");
    used.add(pick.id);
    pick._pos = "DH";
    chosen.push(pick);
  }
  const byOff = [...chosen].sort((a, b) => batScore(b) - batScore(a));
  const byPwr = [...chosen].sort((a, b) => powerScore(b) - powerScore(a));
  const bySpd = [...chosen].sort((a, b) => b.speed - a.speed);
  const batting = [];
  const take = (list) => {
    const f = list.find((p) => !batting.includes(p));
    if (f) batting.push(f);
  };
  take(bySpd);
  take(byOff);
  take(byPwr);
  take(byPwr);
  take(byPwr);
  while (batting.length < chosen.length) take(byOff);
  team.lineup = batting.map((p) => ({ id: p.id, pos: p._pos || p.pos }));
  for (const p of chosen) delete p._pos;
  for (const slot of team.lineup) {
    if (!team.active.includes(slot.id)) {
      team.farm = team.farm.filter((id) => id !== slot.id);
      if (team.active.length < ACTIVE_MAX) team.active.push(slot.id);
    }
  }
  team.lineupCustom = false;
}

export function autoRotation(state, team, posture = "") {
  const arms = team.active
    .map((id) => state.players[id])
    .filter((p) => p && p.isPitcher && !p.retired);
  if (posture !== "bridge") {
    const sps = arms.filter((p) => p.role === "SP").sort((a, b) => overall(b) - overall(a));
    const rest = arms.filter((p) => p.role !== "SP").sort((a, b) => overall(b) - overall(a));
    team.rotation = [...sps, ...rest].slice(0, 5).map((p) => p.id);
    team.rotationCustom = false;
    return;
  }
  const take = (pool) => {
    if (!pool.length) return null;
    const best = Math.max(...pool.map((p) => overall(p)));
    const close = pool.filter((p) => best - overall(p) <= 3);
    close.sort((a, b) => a.age - b.age || overall(b) - overall(a));
    const pick = close[0];
    pool.splice(pool.indexOf(pick), 1);
    return pick;
  };
  const sps = arms.filter((p) => p.role === "SP");
  const rest = arms.filter((p) => p.role !== "SP");
  const rot = [];
  while (rot.length < 5 && (sps.length || rest.length)) {
    const pick = take(sps.length ? sps : rest);
    if (!pick) break;
    rot.push(pick);
  }
  team.rotation = rot.map((p) => p.id);
  team.rotationCustom = false;
}

export function defenseRating(state, team) {
  const weights = { C: 1.15, "1B": 0.55, "2B": 1.0, "3B": 1.0, SS: 1.3, LF: 0.8, CF: 1.2, RF: 0.9, DH: 0 };
  let num = 0;
  let den = 0;
  for (const slot of team.lineup) {
    const p = state.players[slot.id];
    const w = weights[slot.pos] || 0;
    if (!p || !w) continue;
    num += ((p.defense - 20) / 60) * w;
    den += w;
  }
  if (!den) return 0.5;
  return clamp(num / den, 0.05, 0.95);
}

export function lineupValid(state, team) {
  if (!team.lineup || team.lineup.length !== 9) return false;
  const seen = new Set();
  const poss = new Set();
  for (const slot of team.lineup) {
    const p = state.players[slot.id];
    if (!p || p.isPitcher || p.retired || p.injuredWeeks > 0) return false;
    if (!team.active.includes(p.id)) return false;
    if (seen.has(p.id) || poss.has(slot.pos)) return false;
    if (!FIELD_POSITIONS.includes(slot.pos)) return false;
    seen.add(p.id);
    poss.add(slot.pos);
  }
  return poss.size === 9;
}

export { FIELD_POSITIONS, fullName };
