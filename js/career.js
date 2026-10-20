import { evaluateAchievements } from "./achieve.js";
import {
  ACTIVE_MAX,
  DEADLINE_WEEK,
  FARM_MAX,
  FIELD_POSITIONS,
  LUXURY,
  MIN_SALARY,
  SAVE_VERSION,
  SEASON_WEEKS,
  SERIES_DAYS,
  SITUATIONS,
  TEAMS,
} from "./data.js";
import {
  autoLineup,
  autoRotation,
  canPlay,
  createPlayer,
  displayGrade,
  emptyBat,
  emptyPit,
  fitPayroll,
  gradeLabel,
  lineupValid,
  marketSalary,
  overall,
  payrollOf,
  rosterPlayers,
  stockTeam,
  surplusValue,
  talentWar,
} from "./roster.js";
import { simulateGame } from "./sim.js";
import {
  clamp,
  fmtMoney,
  fullName,
  makeRng,
  mutate,
  round1,
  teamLabel,
} from "./util.js";

export { ACHIEVEMENTS, achievementById } from "./achieve.js";
export { DIFFICULTIES, GAME_VERSION, MANUAL, SITUATIONS, TEAMS } from "./data.js";
export {
  displayGrade,
  gradeLabel,
  marketSalary,
  overall,
  payrollOf,
  talentWar,
} from "./roster.js";
export { fullName, teamLabel };

function teamById(state, id) {
  return state.teams.find((t) => t.id === id) || null;
}

function userTeam(state) {
  return teamById(state, state.userTeamId);
}

function employed(state) {
  return !state.gm.fired && !state.gm.retired;
}

function emptyBooks() {
  return { tickets: 0, media: 0, payroll: 0, staff: 0, dead: 0, tax: 0, cashIn: 0, cashOut: 0 };
}

function emptyMeta() {
  return {
    careerWins: 0,
    titles: 0,
    pennants: 0,
    playoffs: 0,
    seasons: 0,
    blackSeasons: 0,
    perfectGames: 0,
    noHitters: 0,
    cycles: 0,
    sweeps: 0,
    bargain: false,
    blockbuster: false,
    buyer: false,
    fireSale: 0,
    fireSaleYear: 0,
    firesaleTitle: false,
    securityMin: 100,
    securityWasLow: false,
    homegrownMvp: false,
    lowPayrollTitle: false,
    buyerTitle: false,
    comebackTitle: false,
    readManual: false,
    sellout: false,
    heavy: false,
    longball: false,
    ironman: false,
    cy: false,
    roy: false,
    cantMiss: false,
    jobPerfect: false,
    cleanBooks: false,
  };
}

function defaultStaff(situation) {
  if (situation === "contender") return { scouting: 3, development: 3, marketing: 6, analytics: 5 };
  if (situation === "rebuild") return { scouting: 7, development: 8, marketing: 2, analytics: 3 };
  return { scouting: 4, development: 4, marketing: 4, analytics: 3 };
}

function sanitizeName(name) {
  const s = String(name || "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 28);
  return s || "Jordan Hale";
}

function scoutStart(state) {
  return state.difficulty === "sharp" ? 15 : state.difficulty === "lenient" ? 7 : 11;
}

function pushNews(state, item) {
  state.news.unshift({
    id: `n${state.nextNote++}`,
    year: state.year,
    week: state.week,
    ...item,
  });
  if (state.news.length > 80) state.news.length = 80;
}

function pushInbox(state, item) {
  state.inbox.unshift({
    id: `i${state.nextNote++}`,
    resolved: false,
    year: state.year,
    week: state.week,
    ...item,
  });
  if (state.inbox.length > 18) state.inbox.length = 18;
}

function checkAchievements(state) {
  const fresh = evaluateAchievements(state);
  if (fresh.length) state.pendingToasts = fresh;
  return fresh;
}

function noteSecurity(state, delta) {
  if (state.cpu) return;
  const mult = state.difficulty === "lenient" ? 0.72 : state.difficulty === "sharp" ? 1.28 : 1;
  state.gm.security = clamp(state.gm.security + delta * mult, 0, 100);
  state.meta.securityMin = Math.min(state.meta.securityMin, state.gm.security);
  if (state.gm.security <= 15) state.meta.securityWasLow = true;
  if (state.phase === "season" && state.gm.security <= 0) {
    dismiss(state, "The owner clears your desk before the week is out.");
  }
}

function dismiss(state, reason) {
  if (state.gm.fired || state.gm.retired || state.cpu) return;
  state.gm.fired = true;
  state.phase = "legacy";
  state.letter = reason;
  pushNews(state, {
    kind: "job",
    title: "You have been dismissed",
    body: reason,
  });
  checkAchievements(state);
}

function circleRounds(ids) {
  const n = ids.length;
  const fixed = ids[0];
  let rot = ids.slice(1);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const row = [fixed, ...rot];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([row[i], row[n - 1 - i]]);
    rounds.push(pairs);
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)];
  }
  return rounds;
}

function divisionRounds(leagueTeams) {
  const by = {};
  for (const t of leagueTeams) (by[t.division] ||= []).push(t.id);
  const divs = Object.values(by);
  const per = divs.map((ids) => {
    const [a, b, c, d] = ids;
    return [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
  });
  const rounds = [[], [], []];
  for (let r = 0; r < 3; r++) for (const d of per) rounds[r].push(...d[r]);
  return rounds;
}

function balanceHome(weeks) {
  const count = {};
  const series = [];
  for (const week of weeks) {
    for (const g of week) {
      count[g.home] = (count[g.home] || 0) + 1;
      count[g.away] = count[g.away] || 0;
      series.push(g);
    }
  }
  const ids = Object.keys(count);
  for (let iter = 0; iter < 48; iter++) {
    let hi = ids[0];
    let lo = ids[0];
    for (const id of ids) {
      if (count[id] > count[hi]) hi = id;
      if (count[id] < count[lo]) lo = id;
    }
    if (count[hi] - count[lo] <= 2) break;
    const game = series.find((g) => g.home === hi && count[g.away] <= count[hi] - 1);
    if (!game) break;
    count[game.home] -= 1;
    count[game.away] += 1;
    const tmp = game.home;
    game.home = game.away;
    game.away = tmp;
  }
}

export function buildSchedule(teams) {
  const weeks = Array.from({ length: SEASON_WEEKS }, () => []);
  for (const league of ["Harbor", "Summit"]) {
    const leagueTeams = teams.filter((t) => t.league === league);
    const rounds = circleRounds(leagueTeams.map((t) => t.id));
    const extra = divisionRounds(leagueTeams);
    rounds.splice(4, 0, extra[0]);
    rounds.splice(9, 0, extra[1]);
    rounds.splice(13, 0, extra[2]);
    rounds.forEach((pairs, w) => {
      pairs.forEach(([a, b], i) => {
        const flip = (w + i) % 2 === 0;
        weeks[w].push({
          home: flip ? a : b,
          away: flip ? b : a,
          results: [null, null, null, null],
        });
      });
    });
  }
  balanceHome(weeks);
  return weeks;
}

function createScrub(state, rng, team, pos) {
  const used = new Set(Object.values(state.players).map((p) => `${p.first} ${p.last}`));
  const idRef = { n: state.nextId };
  const p = createPlayer(rng, {
    pos,
    age: rng.intRange(23, 29),
    farm: true,
    target: rng.intRange(36, 44),
    teamId: team.id,
    noise: 0,
  }, used, idRef);
  state.nextId = idRef.n;
  p.scoutNoise = team.id === state.userTeamId ? 0 : scoutStart(state);
  state.players[p.id] = p;
  return p;
}

function ensureRosters(state, rng) {
  for (const team of state.teams) {
    const seen = new Set();
    const clean = (arr) => arr.filter((id) => {
      const p = state.players[id];
      if (!p || p.retired || seen.has(id)) return false;
      seen.add(id);
      p.teamId = team.id;
      return true;
    });
    team.active = clean(team.active);
    team.farm = clean(team.farm);
    const org = () => [...team.active, ...team.farm].map((id) => state.players[id]).filter(Boolean);
    let guard = 0;
    while (org().filter((p) => !p.isPitcher).length < 13 && guard++ < 6) {
      team.farm.push(createScrub(state, rng, team, rng.pick(["C", "SS", "CF", "1B"])).id);
    }
    guard = 0;
    while (org().filter((p) => p.isPitcher).length < 12 && guard++ < 6) {
      team.farm.push(createScrub(state, rng, team, rng.chance(0.4) ? "SP" : "RP").id);
    }
    const pull = (pred) => {
      if (team.active.length >= ACTIVE_MAX) return false;
      const idx = team.farm.findIndex((id) => pred(state.players[id]));
      if (idx < 0) return false;
      const [id] = team.farm.splice(idx, 1);
      team.active.push(id);
      return true;
    };
    guard = 0;
    while (guard++ < 8 && team.active.filter((id) => {
      const p = state.players[id];
      return p && !p.isPitcher && !p.injuredWeeks;
    }).length < 9) {
      if (!pull((p) => p && !p.isPitcher && !p.injuredWeeks)) break;
    }
    guard = 0;
    while (guard++ < 8 && team.active.filter((id) => {
      const p = state.players[id];
      return p && p.isPitcher && !p.injuredWeeks;
    }).length < 8) {
      if (!pull((p) => p && p.isPitcher && !p.injuredWeeks)) break;
    }
    guard = 0;
    while (team.active.length > ACTIVE_MAX && guard++ < 8) {
      const protectedIds = new Set([...team.lineup.map((s) => s.id), ...team.rotation]);
      const extras = team.active.filter((id) => !protectedIds.has(id));
      const pool = (extras.length ? extras : team.active).slice();
      pool.sort((a, b) => overall(state.players[a]) - overall(state.players[b]));
      const id = pool[0];
      team.active = team.active.filter((x) => x !== id);
      team.lineup = team.lineup.filter((s) => s.id !== id);
      team.rotation = team.rotation.filter((x) => x !== id);
      if (team.farm.length < FARM_MAX) team.farm.push(id);
      else state.players[id].retired = true;
    }
    while (team.farm.length > FARM_MAX) {
      const farm = team.farm.map((id) => state.players[id]).filter(Boolean);
      farm.sort((a, b) => (a.potential + overall(a)) - (b.potential + overall(b)));
      const drop = farm.find((p) => !(p.age <= 21 && p.potential >= 64)) || farm[0];
      team.farm = team.farm.filter((id) => id !== drop.id);
      drop.retired = true;
      drop.teamId = null;
    }
    repairLineup(state, team);
    repairRotation(state, team);
  }
}

function repairLineup(state, team) {
  if (lineupValid(state, team)) return;
  if (team.lineupCustom && team.lineup.length) {
    const used = new Set();
    const pool = team.active.map((id) => state.players[id]).filter((p) => p && !p.isPitcher && !p.injuredWeeks);
    for (const slot of team.lineup) {
      const p = state.players[slot.id];
      const ok = p && !p.isPitcher && !p.injuredWeeks && team.active.includes(p.id) && !used.has(p.id);
      if (ok) {
        used.add(p.id);
        continue;
      }
      const repl = pool.find((q) => !used.has(q.id) && canPlay(q, slot.pos)) || pool.find((q) => !used.has(q.id));
      if (repl) {
        slot.id = repl.id;
        used.add(repl.id);
      }
    }
    const poss = new Set(team.lineup.map((s) => s.pos));
    if (lineupValid(state, team) && poss.size === 9) return;
  }
  autoLineup(state, team);
}

function repairRotation(state, team) {
  team.rotation = team.rotation.filter((id) => {
    const p = state.players[id];
    return p && p.isPitcher && !p.injuredWeeks && !p.retired && team.active.includes(id);
  });
  const have = new Set(team.rotation);
  if (team.rotation.length < 5) {
    const arms = team.active
      .map((id) => state.players[id])
      .filter((p) => p && p.isPitcher && !p.injuredWeeks && !have.has(p.id))
      .sort((a, b) => overall(b) - overall(a));
    while (team.rotation.length < 5 && arms.length) team.rotation.push(arms.shift().id);
  }
  team.rotation = team.rotation.slice(0, 5);
  if (team.rotation.length < 5) autoRotation(state, team);
}

function bumpTools(p, n) {
  const keys = p.isPitcher ? ["stuff", "control", "movement"] : ["contact", "power", "eye", "defense"];
  for (const k of keys) p[k] = clamp(Math.round(p[k] + n), 25, 80);
}

function applySituation(state) {
  const team = userTeam(state);
  if (state.situation === "contender") {
    team.owner.style = "win-now";
    const core = rosterPlayers(state, team)
      .filter((p) => team.active.includes(p.id))
      .sort((a, b) => overall(b) - overall(a))
      .slice(0, 10);
    for (const p of core) bumpTools(p, 4);
  } else if (state.situation === "rebuild") {
    team.owner.style = "patient";
    for (const p of rosterPlayers(state, team)) {
      if (team.active.includes(p.id) && p.age >= 28) bumpTools(p, -5);
      if (team.farm.includes(p.id)) p.potential = clamp(p.potential + 7, 40, 80);
    }
  }
}

function makeGoals(state) {
  const team = userTeam(state);
  const style = team.owner.style;
  const goals = [];
  if (style === "win-now" || state.situation === "contender") {
    goals.push({ id: "div", type: "division", text: "Win the division" });
    goals.push({ id: "po", type: "playoffs", text: "Reach October" });
  } else if (state.situation === "rebuild" || style === "patient") {
    goals.push({ id: "win", type: "wins", text: "Win 24 games", n: 24 });
    goals.push({ id: "rookie", type: "rookie", text: "Play a rookie in 20 games", n: 20 });
  } else {
    goals.push({ id: "win", type: "wins", text: "Win 28 games", n: 28 });
    goals.push({ id: "po", type: "playoffs", text: "Reach October" });
  }
  if (style === "cheap") goals.push({ id: "pay", type: "payroll", text: "Stay under the payroll budget" });
  else goals.push({ id: "profit", type: "profit", text: "Turn a profit" });
  return goals.slice(0, 3);
}

function writePaper(state, headline, deck, body) {
  state.paper = {
    kicker: "The Corner Post",
    headline,
    deck,
    body,
  };
}

function openingOpponent(state) {
  const g = state.schedule[0]?.find((s) => s.home === state.userTeamId || s.away === state.userTeamId);
  if (!g) return "the league";
  const opp = g.home === state.userTeamId ? g.away : g.home;
  const where = g.home === state.userTeamId ? "at home" : "on the road";
  return `${teamLabel(teamById(state, opp))} ${where}`;
}

function beginYear(state, rng, advanced) {
  if (advanced) state.year += 1;
  for (const team of state.teams) {
    team.wins = 0;
    team.losses = 0;
    team.rs = 0;
    team.ra = 0;
    team.h2h = {};
    team.attendanceTotal = 0;
    team.homeGames = 0;
    team.rotationTurn = 0;
  }
  for (const p of Object.values(state.players)) {
    if (p.retired) continue;
    p.season = { bat: emptyBat(), pit: emptyPit() };
    p.wasRookie = (p.service || 0) === 0 && p.age <= 26;
    p.injuredWeeks = 0;
  }
  state.books = emptyBooks();
  state.goals = makeGoals(state);
  state.schedule = buildSchedule(state.teams);
  state.week = 0;
  state.day = 0;
  state.plan = null;
  state.playoffs = null;
  state.awards = null;
  state.digest = [];
  state.meta.buyer = false;
  state.meta.fireSale = 0;
  state.meta.sellout = false;
  state.phase = "preseason";
  state.staffLocked = false;
  state.focus = (state.focus || []).filter((id) => {
    const p = state.players[id];
    return p && p.teamId === state.userTeamId && !p.retired && p.age <= 25;
  });
  state.inbox = [];
  const team = userTeam(state);
  writePaper(
    state,
    `${team.city} opens camp`,
    `The ${team.name} report to ${team.parkName}.`,
    `First series: ${openingOpponent(state)}. ${team.owner.name} wants three things this year, and the chair is yours until it is not.`,
  );
  campBattle(state);
}

function campBattle(state) {
  const team = userTeam(state);
  const arms = team.active.map((id) => state.players[id]).filter((p) => p && p.isPitcher && !p.injuredWeeks);
  if (arms.length < 6) return;
  arms.sort((a, b) => overall(b) - overall(a));
  const a = arms[4];
  const b = arms[5];
  pushInbox(state, {
    kind: "camp",
    title: "Fifth starter",
    body: `${fullName(a)} and ${fullName(b)} are the last argument in camp. Name a starter.`,
    aId: a.id,
    bId: b.id,
  });
}

export function createCareer(opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const rng = makeRng(seed || 1);
  const difficulty = ["lenient", "standard", "sharp"].includes(opts.difficulty) ? opts.difficulty : "standard";
  const situation = SITUATIONS.some((s) => s.id === opts.situation) ? opts.situation : "standard";
  const teamId = TEAMS.some((t) => t.id === opts.teamId) ? opts.teamId : "gulls";
  const noise = difficulty === "sharp" ? 15 : difficulty === "lenient" ? 7 : 11;
  const players = {};
  const used = new Set();
  const idRef = { n: 1 };
  const budgetMult = difficulty === "lenient" ? 1.08 : difficulty === "sharp" ? 0.94 : 1;
  const teams = TEAMS.map((t) => ({
    id: t.id,
    city: t.city,
    name: t.name,
    league: t.league,
    division: t.division,
    market: t.market,
    budget: round1(t.budget * (t.id === teamId ? budgetMult : 1)),
    park: t.park,
    parkName: t.parkName,
    colors: t.colors.slice(),
    outlook: t.outlook,
    blurb: t.blurb,
    owner: { name: t.owner.name, style: t.owner.style },
    form: rng.float(-2.4, 2.4),
    wins: 0,
    losses: 0,
    rs: 0,
    ra: 0,
    h2h: {},
    active: [],
    farm: [],
    lineup: [],
    rotation: [],
    lineupCustom: false,
    rotationCustom: false,
    rotationTurn: 0,
    attendanceTotal: 0,
    homeGames: 0,
  }));
  for (const team of teams) {
    const made = stockTeam(rng, team, used, idRef, team.id === teamId ? 0 : noise);
    for (const p of made) {
      if (team.id === teamId) p.scoutNoise = 0;
      players[p.id] = p;
    }
  }
  const state = {
    version: SAVE_VERSION,
    seed,
    rng: 1,
    year: 2026,
    difficulty,
    situation,
    cpu: !!opts.cpu,
    gm: {
      name: sanitizeName(opts.gmName),
      security: situation === "contender" ? 64 : situation === "rebuild" ? 78 : 72,
      fired: false,
      retired: false,
    },
    userTeamId: teamId,
    teams,
    players,
    nextId: idRef.n,
    nextNote: 1,
    freeAgents: [],
    focus: [],
    growth: null,
    plan: null,
    posture: null,
    phase: "preseason",
    week: 0,
    day: 0,
    schedule: [],
    playoffs: null,
    news: [],
    inbox: [],
    tenders: {},
    faBids: {},
    faWeek: 0,
    draft: null,
    staff: defaultStaff(situation),
    staffLocked: false,
    books: emptyBooks(),
    goals: [],
    paper: null,
    digest: [],
    seasons: [],
    champions: [],
    awardsLog: [],
    awards: null,
    meta: emptyMeta(),
    achievements: {},
    seenTutorial: false,
    pendingToasts: [],
    flash: "",
    letter: "",
    lastBox: null,
  };
  applySituation(state);
  for (const team of state.teams) fitPayroll(state, team);
  ensureRosters(state, rng);
  beginYear(state, rng, false);
  state.rng = rng.state();
  state.flash = `The ${teamLabel(userTeam(state))} desk is yours.`;
  checkAchievements(state);
  return state;
}

function attendanceRate(state, team) {
  const g = team.wins + team.losses;
  const wp = g ? team.wins / g : 0.48;
  const stars = team.active.filter((id) => overall(state.players[id]) >= 64).length;
  const marketing = team.id === state.userTeamId ? state.staff.marketing : 4;
  return clamp(0.4 + wp * 0.36 + Math.min(0.16, stars * 0.045) + (marketing - 4) * 0.04 + (team.market - 1) * 0.04, 0.28, 0.99);
}

function maybeInjure(state, rng, p, pitcher) {
  if (!p || p.injuredWeeks || p.retired) return;
  let chance = (pitcher ? 0.01 : 0.0075) * (1.45 - (p.durability - 20) / 60);
  if (!state.cpu && state.plan?.focus === "rest" && state.plan.week === state.week && p.teamId === state.userTeamId) chance *= 0.55;
  if (!rng.chance(chance)) return;
  p.injuredWeeks = rng.intRange(1, pitcher ? 6 : 4);
  p.morale = clamp(p.morale - 6, 20, 95);
  if (p.teamId === state.userTeamId) {
    pushNews(state, {
      kind: "injury",
      title: `${fullName(p)} leaves the club`,
      body: `${fullName(p)} will miss about ${p.injuredWeeks} week${p.injuredWeeks === 1 ? "" : "s"}.`,
    });
    pushInbox(state, {
      kind: "info",
      title: `${p.last} is hurt`,
      body: `${fullName(p)} is out roughly ${p.injuredWeeks} week${p.injuredWeeks === 1 ? "" : "s"}. The staff will patch the lineup.`,
    });
  }
}

function applyBox(state, rng, box, playoff = false) {
  const home = teamById(state, box.homeId);
  const away = teamById(state, box.awayId);
  if (!playoff) {
    if (box.winner === home.id) {
      home.wins += 1;
      away.losses += 1;
      home.h2h[away.id] = (home.h2h[away.id] || 0) + 1;
    } else {
      away.wins += 1;
      home.losses += 1;
      away.h2h[home.id] = (away.h2h[home.id] || 0) + 1;
    }
    home.rs += box.homeRuns;
    home.ra += box.awayRuns;
    away.rs += box.awayRuns;
    away.ra += box.homeRuns;
  }
  const rate = attendanceRate(state, home);
  const crowd = Math.round(26000 * home.market * rate);
  home.attendanceTotal += crowd;
  home.homeGames += 1;
  if (home.id === state.userTeamId) {
    state.books.tickets += (crowd * home.budget * 0.42) / 1e6;
    if (rate >= 0.96) state.meta.sellout = true;
  }
  for (const tid of [home.id, away.id]) {
    const team = teamById(state, tid);
    for (const slot of team.lineup) maybeInjure(state, rng, state.players[slot.id], false);
  }
  if (box.wp) maybeInjure(state, rng, state.players[box.wp], true);
  if (box.perfect && box.perfect === state.userTeamId) state.meta.perfectGames += 1;
  if (box.noHitter && box.noHitter === state.userTeamId) state.meta.noHitters += 1;
  if (box.cycle && state.players[box.cycle]?.teamId === state.userTeamId) state.meta.cycles += 1;
  if (!playoff && box.winner === state.userTeamId) state.meta.careerWins += 1;
  if (box.homeId === state.userTeamId || box.awayId === state.userTeamId) state.lastBox = box;
}

function chargeDay(state) {
  const team = userTeam(state);
  const staff = state.staff.scouting + state.staff.development + state.staff.marketing + state.staff.analytics;
  state.books.payroll += payrollOf(state, team) / 56;
  state.books.staff += staff / 56;
  state.books.media += (team.budget * 0.58) / 56;
}

function summarizeWeek(state, week) {
  const games = state.schedule[week] || [];
  const series = games.find((g) => g.home === state.userTeamId || g.away === state.userTeamId);
  const boxes = series ? series.results.filter(Boolean) : [];
  let w = 0;
  let l = 0;
  for (const box of boxes) {
    if (box.winner === state.userTeamId) w += 1;
    else l += 1;
  }
  return { series, boxes, w, l };
}

function finishWeek(state, rng) {
  const rec = summarizeWeek(state, state.week);
  if (rec.w === 4) state.meta.sweeps += 1;
  const swing = (rec.w - rec.l) * 1.45 + (rec.w === 4 ? 2 : 0) + (rec.l === 4 ? -2 : 0);
  noteSecurity(state, swing);
  if (!employed(state)) return;
  for (const p of Object.values(state.players)) {
    if (p.injuredWeeks > 0) p.injuredWeeks -= 1;
    if (p.teamId && !p.retired) {
      const team = teamById(state, p.teamId);
      const g = team.wins + team.losses;
      const wp = g ? team.wins / g : 0.5;
      if (team.active.includes(p.id)) p.morale = clamp(p.morale + (wp - 0.5) * 3, 25, 92);
      if (!state.cpu && state.plan?.focus === "rest" && state.plan.week === state.week && p.teamId === state.userTeamId && team.active.includes(p.id)) {
        p.morale = clamp(p.morale + 2, 20, 95);
      }
    }
  }
  const decay = clamp(0.9 - state.staff.scouting * 0.03, 0.48, 0.93);
  for (const p of Object.values(state.players)) {
    if (p.retired) continue;
    if (p.teamId === state.userTeamId) p.scoutNoise = 0;
    else if (p.scoutNoise > 0) p.scoutNoise = Math.max(0, p.scoutNoise * decay);
  }
  writeWeekPaper(state, rec);
  state.digest.push({ week: state.week + 1, text: `${rec.w}-${rec.l} against ${opponentName(state, rec.series)}` });
  if (state.digest.length > 20) state.digest.shift();
  refillInbox(state, rng);
  state.day = 0;
  state.week += 1;
  if (state.week >= SEASON_WEEKS && employed(state)) startPlayoffs(state);
}

function opponentName(state, series) {
  if (!series) return "the schedule";
  const id = series.home === state.userTeamId ? series.away : series.home;
  return teamLabel(teamById(state, id));
}

function writeWeekPaper(state, rec) {
  const team = userTeam(state);
  const opp = opponentName(state, rec.series);
  let headline = `${team.name} split the series`;
  if (rec.w === 4) headline = `${team.name} sweep ${opp}`;
  else if (rec.l === 4) headline = `${opp} sweep ${team.city}`;
  else if (rec.w > rec.l) headline = `${team.name} take the series`;
  else if (rec.l > rec.w) headline = `${opp} take the series`;
  const box = rec.boxes.find((b) => b.perfect) || rec.boxes.find((b) => b.noHitter) || rec.boxes.find((b) => b.cycle);
  if (box?.perfect) headline = `Perfect game in ${team.city}`;
  else if (box?.noHitter) headline = `A no-hitter on the books`;
  else if (box?.cycle) headline = `${state.players[box.cycle]?.last || "A batter"} hits for the cycle`;
  const leader = [...state.teams].filter((t) => t.league === team.league).sort(compareTeams)[0];
  let division = "";
  if (rec.series) {
    const home = teamById(state, rec.series.home);
    const away = teamById(state, rec.series.away);
    if (home && away && home.division === away.division && home.league === away.league) {
      division = ` It is a ${home.division} argument, and the town will remember the score.`;
    }
  }
  const body = `${team.city} went ${rec.w}-${rec.l} against ${opp} and sits ${team.wins}-${team.losses}. ${leader.city} leads the ${leader.league} League at ${leader.wins}-${leader.losses}.${division}`;
  writePaper(state, headline, `${team.owner.name} will read this before you do.`, body);
}

function needBonus(state, team, players) {
  let bonus = 0;
  for (const p of players) {
    if (!p) continue;
    if (p.isPitcher && p.role === "SP") {
      const worst = team.rotation.map((id) => state.players[id]).filter(Boolean).sort((a, b) => overall(a) - overall(b))[0];
      if (worst && overall(p) > overall(worst) + 3) bonus += 2.4;
    } else if (!p.isPitcher) {
      const slot = team.lineup.find((s) => s.pos === p.pos);
      const cur = slot ? state.players[slot.id] : null;
      if (cur && overall(p) > overall(cur) + 3) bonus += 2.2;
    }
    if (team.owner.style === "win-now" && p.age >= 27 && p.age <= 32 && talentWar(p) > 1.4) bonus += 1.4;
    if (team.owner.style === "patient" && p.age <= 24) bonus += 1.2;
  }
  return bonus;
}

function tradeEdge(state, theirId, sendIds, recvIds, cashSend, cashRecv) {
  const them = teamById(state, theirId);
  const incoming = sendIds.map((id) => state.players[id]).filter(Boolean);
  const outgoing = recvIds.map((id) => state.players[id]).filter(Boolean);
  const gain = incoming.reduce((s, p) => s + surplusValue(p), 0) + needBonus(state, them, incoming) + cashSend * 0.45;
  const loss = outgoing.reduce((s, p) => s + surplusValue(p), 0) + cashRecv * 0.45;
  return gain - loss;
}

function refillInbox(state, rng) {
  state.inbox.forEach((item) => {
    if (!item.resolved && ["trade", "owner", "callup", "playing", "claim"].includes(item.kind)) item.resolved = true;
  });
  if (state.week >= DEADLINE_WEEK) {
    deskNotes(state, rng);
    return;
  }
  if (rng.chance(0.62)) {
    const offer = craftOffer(state, rng);
    if (offer) {
      const them = teamById(state, offer.teamId);
      const send = offer.send.map((id) => state.players[id].last).join(", ");
      const recv = offer.recv.map((id) => state.players[id].last).join(", ");
      pushInbox(state, {
        kind: "trade",
        title: `${them.city} calls`,
        body: `They will send ${recv} for ${send}${offer.cashRecv ? `, plus ${fmtMoney(offer.cashRecv)}` : ""}.`,
        offer,
      });
    }
  }
  const team = userTeam(state);
  if (team.owner.style === "meddlesome" && rng.chance(0.4)) {
    const bench = team.active
      .map((id) => state.players[id])
      .filter((p) => p && !p.isPitcher && !team.lineup.some((s) => s.id === p.id) && p.age >= 29);
    if (bench.length) {
      const vet = bench.sort((a, b) => overall(b) - overall(a))[0];
      pushInbox(state, {
        kind: "owner",
        title: "A note from the box",
        body: `${team.owner.name} wants ${fullName(vet)} in the lineup this week. It is not a suggestion.`,
        playerId: vet.id,
      });
    }
  }
  if (state.gm.security < 25 && rng.chance(0.5)) {
    pushInbox(state, {
      kind: "info",
      title: "The owner is watching",
      body: `${team.owner.name} has started taking the calls you used to take. Win a series.`,
    });
  }
  deskNotes(state, rng);
}

function deskNotes(state, rng) {
  const team = userTeam(state);
  if (rng.chance(0.45)) maybeCallup(state, rng, team);
  if (rng.chance(0.34)) maybePlayingTime(state, rng, team);
  if (rng.chance(0.3)) maybeClaim(state, rng, team);
}

function maybeCallup(state, rng, team) {
  const farm = team.farm.map((id) => state.players[id]).filter((p) => p && p.age <= 24 && p.potential >= 58 && !p.injuredWeeks);
  if (!farm.length) return;
  const kid = farm.slice().sort((a, b) => overall(b) - overall(a))[0];
  const peers = team.active.map((id) => state.players[id]).filter((p) => p && p.isPitcher === kid.isPitcher && !p.injuredWeeks);
  const worst = peers.slice().sort((a, b) => overall(a) - overall(b))[0];
  if (!worst || overall(kid) < overall(worst) - 6) return;
  if (rng.chance(0.35) && overall(kid) < overall(worst)) return;
  pushInbox(state, {
    kind: "callup",
    title: `${kid.last} is knocking`,
    body: `${fullName(kid)} is on the staff's card next to ${fullName(worst)}. Call him up or leave him on the farm.`,
    playerId: kid.id,
    replaceId: worst.id,
  });
}

function maybePlayingTime(state, rng, team) {
  const starters = new Set(team.lineup.map((s) => s.id));
  const bench = team.active
    .map((id) => state.players[id])
    .filter((p) => p && !p.isPitcher && !starters.has(p.id) && !p.injuredWeeks && (p.personality === "volatile" || p.personality === "loyal"));
  if (!bench.length) return;
  const p = rng.pick(bench);
  for (let i = 0; i < team.lineup.length; i += 1) {
    const slot = team.lineup[i];
    if (!canPlay(p, slot.pos)) continue;
    const cur = state.players[slot.id];
    if (!cur || overall(p) + 12 < overall(cur)) continue;
    pushInbox(state, {
      kind: "playing",
      title: `${p.last} wants the card`,
      body: `${fullName(p)} wants the ${positionName(slot.pos)} spot ahead of ${cur.last}. He will remember the answer.`,
      playerId: p.id,
      slot: i,
    });
    return;
  }
}

function positionName(pos) {
  return {
    C: "catcher",
    "1B": "first base",
    "2B": "second base",
    "3B": "third base",
    SS: "shortstop",
    LF: "left field",
    CF: "center field",
    RF: "right field",
    DH: "designated hitter",
    SP: "starter",
    RP: "relief",
  }[pos] || "the field";
}

function maybeClaim(state, rng, team) {
  if (team.farm.length >= FARM_MAX) return;
  const pool = [];
  for (const them of state.teams) {
    if (them.id === team.id) continue;
    for (const id of them.farm) {
      const p = state.players[id];
      if (!p || p.injuredWeeks || p.age > 23 || p.potential < 62 || overall(p) > 54) continue;
      pool.push(p);
    }
  }
  if (!pool.length) return;
  pool.sort((a, b) => b.potential - a.potential);
  const p = rng.chance(0.5) ? pool[0] : rng.pick(pool.slice(0, Math.min(8, pool.length)));
  const them = teamById(state, p.teamId);
  pushInbox(state, {
    kind: "claim",
    title: `${them.city} might lose ${p.last}`,
    body: `${fullName(p)}, ${p.age}, plays ${positionName(p.pos)} for ${them.city}. Another club can live without him. The claim fee is ${fmtMoney(0.4)}, and the farm has a bed.`,
    playerId: p.id,
    fee: 0.4,
  });
}

function craftOffer(state, rng) {
  const user = userTeam(state);
  const others = state.teams.filter((t) => t.id !== user.id);
  for (let attempt = 0; attempt < 10; attempt++) {
    const them = rng.pick(others);
    const mine = user.active.map((id) => state.players[id]).filter((p) => p && !p.injuredWeeks);
    if (!mine.length) return null;
    const shop = mine.filter((p) => p.onBlock);
    const target = shop.length && rng.chance(0.75) ? rng.pick(shop) : rng.pick(mine);
    const theirs = them.active.map((id) => state.players[id]).filter(Boolean);
    if (!theirs.length) continue;
    let partner = theirs[0];
    let best = Infinity;
    const tv = surplusValue(target);
    for (const p of theirs) {
      const d = Math.abs(surplusValue(p) - tv);
      if (d < best) {
        best = d;
        partner = p;
      }
    }
    const send = [target.id];
    const recv = [partner.id];
    const edge = tradeEdge(state, them.id, send, recv, 0, 0);
    if (edge > 0.2) return { teamId: them.id, send, recv, cashSend: 0, cashRecv: 0 };
  }
  return null;
}

function simDayInner(state, rng) {
  if (!employed(state)) return { ok: false, message: state.letter || "The career is over." };
  if (state.phase !== "season") return { ok: false, message: "There is no regular-season game today." };
  ensureRosters(state, rng);
  const games = state.schedule[state.week] || [];
  for (const g of games) {
    if (g.results[state.day]) continue;
    const log = g.home === state.userTeamId || g.away === state.userTeamId;
    const box = simulateGame(state, rng, g.home, g.away, { log });
    g.results[state.day] = box;
    applyBox(state, rng, box, false);
  }
  chargeDay(state);
  const series = games.find((g) => g.home === state.userTeamId || g.away === state.userTeamId);
  const box = series?.results[state.day];
  if (box) {
    const won = box.winner === state.userTeamId;
    const opp = opponentName(state, series);
    state.today = `${won ? "Win" : "Loss"} against ${opp}, ${Math.max(box.homeRuns, box.awayRuns)}-${Math.min(box.homeRuns, box.awayRuns)}.`;
  }
  state.day += 1;
  if (state.day >= SERIES_DAYS) finishWeek(state, rng);
  else if (employed(state)) state.flash = state.today;
  if (!state.flash) state.flash = state.today || "The day is in the books.";
  checkAchievements(state);
  return { ok: true, message: state.flash };
}

export function simDay(state) {
  return mutate(state, (rng) => simDayInner(state, rng));
}

export function simWeek(state) {
  return mutate(state, (rng) => {
    if (state.phase !== "season") return { ok: false, message: "The regular season is not in progress." };
    const start = state.week;
    let guard = 0;
    while (employed(state) && state.phase === "season" && state.week === start && guard++ < 6) {
      simDayInner(state, rng);
    }
    return { ok: true, message: state.flash };
  });
}

export function simToOctober(state) {
  return mutate(state, (rng) => {
    if (state.phase === "preseason") return { ok: false, message: "Open the season first." };
    let guard = 0;
    while (employed(state) && state.phase === "season" && guard++ < 80) simDayInner(state, rng);
    state.flash = state.phase === "playoffs" ? "The regular season is over." : state.flash;
    return { ok: true, message: state.flash };
  });
}

function compareTeams(a, b) {
  if (a.wins !== b.wins) return b.wins - a.wins;
  const h2h = (a.h2h?.[b.id] || 0) - (b.h2h?.[a.id] || 0);
  if (h2h) return -h2h;
  const diffA = a.rs - a.ra;
  const diffB = b.rs - b.ra;
  if (diffA !== diffB) return diffB - diffA;
  return a.id < b.id ? -1 : 1;
}

function makeSeries(high, low, need) {
  return { high, low, need, wins: { [high]: 0, [low]: 0 }, games: [], winner: null, loser: null };
}

function startPlayoffs(state) {
  const pack = {};
  let userIn = false;
  for (const league of ["Harbor", "Summit"]) {
    const teams = state.teams.filter((t) => t.league === league);
    const divisions = [...new Set(teams.map((t) => t.division))];
    const winners = divisions.map((d) => teams.filter((t) => t.division === d).sort(compareTeams)[0].id);
    const rest = teams.filter((t) => !winners.includes(t.id)).sort(compareTeams);
    const seeds = [...winners, rest[0].id].sort((a, b) => compareTeams(teamById(state, a), teamById(state, b)));
    if (seeds.includes(state.userTeamId)) userIn = true;
    pack[league] = {
      seeds,
      ds: [makeSeries(seeds[0], seeds[3], 3), makeSeries(seeds[1], seeds[2], 3)],
      final: null,
      champion: null,
    };
  }
  state.playoffs = {
    round: "ds",
    leagues: pack,
    continental: null,
    champion: null,
    userFinish: userIn ? "playoffs" : "missed",
    log: [],
  };
  state.phase = "playoffs";
  if (userIn) state.meta.playoffs += 1;
  const team = userTeam(state);
  writePaper(
    state,
    userIn ? `${team.city} is in` : `${team.city} watches October`,
    userIn ? "The bracket is set." : "The schedule is done. The bracket is not yours.",
    userIn
      ? `${team.name} finish ${team.wins}-${team.losses} and take a place in October.`
      : `${team.name} finish ${team.wins}-${team.losses}. The owner will have notes.`,
  );
  checkAchievements(state);
}

function playSeriesGame(state, rng, series) {
  if (!series || series.winner) return null;
  const i = series.games.length;
  const pat = series.need === 3 ? [1, 1, 0, 0, 1] : [1, 1, 0, 0, 1, 1, 1];
  const highHome = pat[Math.min(i, pat.length - 1)] === 1;
  const homeId = highHome ? series.high : series.low;
  const awayId = highHome ? series.low : series.high;
  ensureRosters(state, rng);
  const log = homeId === state.userTeamId || awayId === state.userTeamId;
  const box = simulateGame(state, rng, homeId, awayId, { log });
  series.games.push(box);
  series.wins[box.winner] = (series.wins[box.winner] || 0) + 1;
  if (series.wins[box.winner] >= series.need) {
    series.winner = box.winner;
    series.loser = box.winner === series.high ? series.low : series.high;
  }
  applyBox(state, rng, box, true);
  return box;
}

function betterSeed(state, a, b) {
  return compareTeams(teamById(state, a), teamById(state, b)) <= 0 ? a : b;
}

function simPlayoffInner(state, rng) {
  if (state.phase !== "playoffs") return { ok: false, message: "October is not in session." };
  const po = state.playoffs;
  if (po.round === "ds") {
    for (const league of Object.values(po.leagues)) {
      for (const series of league.ds) playSeriesGame(state, rng, series);
    }
    if (Object.values(po.leagues).every((l) => l.ds.every((s) => s.winner))) {
      for (const league of Object.values(po.leagues)) {
        const a = league.ds[0].winner;
        const b = league.ds[1].winner;
        const high = betterSeed(state, a, b);
        const low = high === a ? b : a;
        league.final = makeSeries(high, low, 4);
      }
      po.round = "lcs";
    }
  } else if (po.round === "lcs") {
    for (const league of Object.values(po.leagues)) playSeriesGame(state, rng, league.final);
    if (Object.values(po.leagues).every((l) => l.final?.winner)) {
      for (const league of Object.values(po.leagues)) {
        league.champion = league.final.winner;
        if (league.champion === state.userTeamId) {
          po.userFinish = "pennant";
          state.meta.pennants += 1;
        }
      }
      const harbor = po.leagues.Harbor.champion;
      const summit = po.leagues.Summit.champion;
      const high = betterSeed(state, harbor, summit);
      const low = high === harbor ? summit : harbor;
      po.continental = makeSeries(high, low, 4);
      po.round = "cs";
    }
  } else if (po.round === "cs") {
    playSeriesGame(state, rng, po.continental);
    if (po.continental.winner) {
      po.champion = po.continental.winner;
      po.round = "done";
      if (po.champion === state.userTeamId) {
        po.userFinish = "champion";
        state.meta.titles += 1;
        if (state.meta.securityWasLow) state.meta.comebackTitle = true;
        if (state.meta.buyer) state.meta.buyerTitle = true;
        if (state.meta.fireSaleYear && state.year - state.meta.fireSaleYear <= 6) state.meta.firesaleTitle = true;
        const payrolls = state.teams.map((t) => payrollOf(state, t)).sort((a, b) => a - b);
        const mine = payrollOf(state, userTeam(state));
        if (payrolls.indexOf(mine) <= 4) state.meta.lowPayrollTitle = true;
      }
      enterRecap(state);
    }
  }
  const last = state.lastBox;
  if (last && (last.homeId === state.userTeamId || last.awayId === state.userTeamId)) {
    const won = last.winner === state.userTeamId;
    state.flash = won ? "October win." : "October loss.";
  } else {
    state.flash = "The rest of the bracket played on.";
  }
  checkAchievements(state);
  return { ok: true, message: state.flash };
}

export function simPlayoffDay(state) {
  return mutate(state, (rng) => simPlayoffInner(state, rng));
}

export function simRestOfOctober(state) {
  return mutate(state, (rng) => {
    let guard = 0;
    while (state.phase === "playoffs" && guard++ < 40) simPlayoffInner(state, rng);
    return { ok: true, message: state.flash || "October is complete." };
  });
}

function leagueLines(state) {
  let pa = 0;
  let ab = 0;
  let h = 0;
  let bb = 0;
  let hbp = 0;
  let d = 0;
  let t = 0;
  let hr = 0;
  let er = 0;
  let outs = 0;
  let r = 0;
  for (const p of Object.values(state.players)) {
    const b = p.season.bat;
    const pit = p.season.pit;
    pa += b.pa; ab += b.ab; h += b.h; bb += b.bb; hbp += b.hbp; d += b.d; t += b.t; hr += b.hr; r += b.r;
    er += pit.er; outs += pit.outs;
  }
  const singles = h - d - t - hr;
  const woba = pa ? (0.69 * bb + 0.72 * hbp + 0.89 * singles + 1.27 * d + 1.62 * t + 2.08 * hr) / pa : 0.32;
  const era = outs ? (er * 27) / outs : 4.3;
  return { pa, ab, h, bb, hr, r, woba, era, outs };
}

function batWar(p, lg) {
  const b = p.season.bat;
  if (!b.pa) return 0;
  const singles = b.h - b.d - b.t - b.hr;
  const woba = (0.69 * b.bb + 0.72 * b.hbp + 0.89 * singles + 1.27 * b.d + 1.62 * b.t + 2.08 * b.hr) / b.pa;
  const off = ((woba - lg.woba) / 1.15) * b.pa;
  const def = ((p.defense - 50) / 12) * (b.g / 56) * (p.pos === "DH" ? 0 : 1);
  return (off + def + b.pa * 0.01) / 8.2;
}

function pitWar(p, lg) {
  const pit = p.season.pit;
  if (!pit.outs) return 0;
  const era = (pit.er * 27) / pit.outs;
  return ((((lg.era || 4.2) - era) * (pit.outs / 3)) / 9) / 8.2;
}

function playerWar(p, lg) {
  return p.isPitcher ? pitWar(p, lg) : batWar(p, lg);
}

function enterRecap(state) {
  const lg = leagueLines(state);
  const players = Object.values(state.players).filter((p) => !p.retired && p.teamId);
  const hitters = players.filter((p) => !p.isPitcher && p.season.bat.pa >= 40);
  const starters = players.filter((p) => p.role === "SP" && p.season.pit.outs >= 60);
  const pens = players.filter((p) => p.role === "RP" && p.season.pit.outs >= 20);
  const rookies = players.filter((p) => p.wasRookie && (p.season.bat.pa >= 30 || p.season.pit.outs >= 30));
  const best = (list, score) => list.slice().sort((a, b) => score(b) - score(a))[0] || null;
  const mvp = best(hitters, (p) => batWar(p, lg));
  const cy = best(starters, (p) => pitWar(p, lg));
  const roy = best(rookies, (p) => playerWar(p, lg));
  const rel = best(pens, (p) => p.season.pit.sv * 2 + pitWar(p, lg));
  const gg = best(hitters.filter((p) => p.pos !== "DH" && p.season.bat.g >= 30), (p) => p.defense + p.season.bat.g / 100);
  const pack = (p, line) => (p ? { id: p.id, name: fullName(p), teamId: p.teamId, line, drafted: p.drafted || null } : null);
  state.awards = {
    mvp: pack(mvp, mvp ? `${mvp.season.bat.hr} HR, ${mvp.season.bat.rbi} RBI` : ""),
    cy: pack(cy, cy ? `${cy.season.pit.w}-${cy.season.pit.l}` : ""),
    roy: pack(roy, roy ? (roy.isPitcher ? `${roy.season.pit.w} wins` : `${roy.season.bat.hr} HR`) : ""),
    reliever: pack(rel, rel ? `${rel.season.pit.sv} saves` : ""),
    glove: pack(gg, gg ? `${gg.pos}` : ""),
  };
  if (mvp?.drafted?.teamId === state.userTeamId) state.meta.homegrownMvp = true;
  if (roy?.teamId === state.userTeamId) state.meta.roy = true;
  if (cy?.teamId === state.userTeamId) state.meta.cy = true;
  const user = userTeam(state);
  for (const p of rosterPlayers(state, user)) {
    if (p.season.bat.hr >= 16) state.meta.longball = true;
    if (!p.isPitcher && p.season.bat.g >= 56) state.meta.ironman = true;
  }
  if (user.wins >= 36) state.meta.heavy = true;
  const finish = state.playoffs?.userFinish || "missed";
  const met = gradeGoals(state, finish);
  applyOwnerReview(state, met, finish);
  const prof = profit(state);
  if (prof > 0 && employed(state)) state.meta.blackSeasons += 1;
  else if (prof > 0 && state.cpu) state.meta.blackSeasons += 1;
  if (state.books.dead <= 0.01 && payrollOf(state, user) < LUXURY) state.meta.cleanBooks = true;
  if (state.gm.security >= 99.5 && employed(state)) state.meta.jobPerfect = true;
  state.meta.seasons += 1;
  state.seasons.push({
    year: state.year,
    teamId: user.id,
    w: user.wins,
    l: user.losses,
    finish,
    profit: round1(prof),
    goals: met,
  });
  if (state.playoffs?.champion) {
    state.champions.push({ year: state.year, teamId: state.playoffs.champion });
  }
  state.awardsLog.push({ year: state.year, awards: state.awards });
  if (state.phase !== "legacy") {
    state.phase = "recap";
    const champ = state.playoffs?.champion ? teamLabel(teamById(state, state.playoffs.champion)) : "Nobody";
    writePaper(state, `${champ} win the Continental Series`, `${user.city} finishes ${user.wins}-${user.losses}.`, state.letter || `Goals met: ${met} of ${state.goals.length}.`);
  }
  checkAchievements(state);
}

function gradeGoals(state, finish) {
  const team = userTeam(state);
  let met = 0;
  const divisionMates = state.teams.filter((t) => t.league === team.league && t.division === team.division);
  const wonDivision = divisionMates.slice().sort(compareTeams)[0].id === team.id;
  for (const goal of state.goals) {
    if (goal.type === "division") goal.met = wonDivision;
    else if (goal.type === "playoffs") goal.met = finish !== "missed";
    else if (goal.type === "wins") goal.met = team.wins >= goal.n;
    else if (goal.type === "profit") goal.met = profit(state) > 0;
    else if (goal.type === "payroll") goal.met = payrollOf(state, team) <= team.budget + 0.05;
    else if (goal.type === "rookie") {
      goal.met = rosterPlayers(state, team).some((p) => p.wasRookie && ((p.season.bat.g || 0) >= goal.n || (p.season.pit.g || 0) >= goal.n));
    }
    if (goal.met) met += 1;
  }
  return met;
}

function applyOwnerReview(state, met, finish) {
  const team = userTeam(state);
  let delta = (met - 1) * 7;
  if (finish === "champion") delta += 18;
  else if (finish === "pennant") delta += 8;
  else if (finish === "playoffs") delta += 3;
  if (team.wins < team.losses) delta -= 4;
  if (team.owner.style === "cheap" && payrollOf(state, team) > team.budget) delta -= 8;
  if (team.owner.style === "win-now" && finish === "missed") delta -= 8;
  const over = Math.max(0, payrollOf(state, team) - LUXURY);
  state.books.tax += over * 0.45;
  noteSecurity(state, delta);
  if (state.cpu || state.gm.fired) return;
  if (state.gm.security <= 0 || (state.difficulty === "sharp" && met === 0 && state.gm.security < 24)) {
    dismiss(state, `${team.owner.name} ends the review without offering another year.`);
  }
}

export function profit(state) {
  const b = state.books;
  return b.tickets + b.media + b.cashIn - b.payroll - b.staff - b.dead - b.tax - b.cashOut;
}

function makeFreeAgent(state, player) {
  for (const team of state.teams) {
    team.active = team.active.filter((id) => id !== player.id);
    team.farm = team.farm.filter((id) => id !== player.id);
    team.lineup = team.lineup.filter((s) => s.id !== player.id);
    team.rotation = team.rotation.filter((id) => id !== player.id);
  }
  player.teamId = null;
  if (!state.freeAgents.includes(player.id)) state.freeAgents.push(player.id);
}

function rollContracts(state) {
  state.tenders = {};
  for (const team of state.teams) {
    const active = new Set(team.active);
    const ids = [...team.active, ...team.farm];
    for (const id of ids) {
      const p = state.players[id];
      if (!p || p.retired || p.teamId !== team.id) continue;
      if (active.has(id)) p.service += 1;
      p.contract.years -= 1;
      if (p.contract.years > 0) continue;
      if (p.service < 3) {
        p.contract = { years: 1, salary: MIN_SALARY, type: "prearb" };
      } else if (p.service < 6) {
        const ask = round1(Math.max(MIN_SALARY, marketSalary(p) * (0.34 + (p.service - 2) * 0.12)));
        if (team.id === state.userTeamId) state.tenders[p.id] = { ask, tender: true };
        else if (ask <= marketSalary(p) * 1.08 || talentWar(p) > 1.1) p.contract = { years: 1, salary: ask, type: "arb" };
        else makeFreeAgent(state, p);
      } else makeFreeAgent(state, p);
    }
  }
}

export function ackRecap(state) {
  if (state.phase !== "recap") return { ok: false, message: "The season is still in progress." };
  if (!employed(state)) return { ok: false, message: state.letter || "The career is over." };
  return mutate(state, () => {
    rollContracts(state);
    state.phase = "tender";
    const n = Object.keys(state.tenders).length;
    state.flash = n ? `${n} arbitration decisions are waiting.` : "No tenders are due. File the papers to open the market.";
    return { ok: true, message: state.flash };
  });
}

export function setTender(state, playerId, tender) {
  if (!state.tenders?.[playerId]) return { ok: false, message: "That player is not awaiting a tender." };
  state.tenders[playerId].tender = !!tender;
  return { ok: true };
}

function startFreeAgency(state) {
  for (const id of state.freeAgents) {
    const p = state.players[id];
    if (!p) continue;
    const mult = p.personality === "mercenary" ? 1.12 : p.personality === "loyal" ? 0.94 : 1;
    p.demand = round1(Math.max(MIN_SALARY, marketSalary(p) * mult));
    p.demandYears = p.age >= 33 ? 1 : p.age >= 30 ? 2 : 3;
  }
  state.faBids = {};
  state.faWeek = 0;
  state.phase = "free_agency";
}

export function fileTenders(state) {
  if (state.phase !== "tender") return { ok: false, message: "Tenders are not on the desk." };
  return mutate(state, (rng) => {
    for (const [id, row] of Object.entries(state.tenders || {})) {
      const p = state.players[id];
      if (!p) continue;
      if (row.tender) p.contract = { years: 1, salary: row.ask, type: "arb" };
      else {
        makeFreeAgent(state, p);
        pushNews(state, { kind: "roster", title: `${p.last} is non-tendered`, body: `${fullName(p)} is free to sign anywhere.` });
      }
    }
    state.tenders = {};
    ensureRosters(state, rng);
    startFreeAgency(state);
    state.flash = "The market is open.";
    return { ok: true, message: state.flash };
  });
}

function teamNeeds(state, team, player) {
  if (!player) return false;
  if (player.isPitcher) {
    if (player.role === "SP") {
      const worst = team.rotation.map((id) => state.players[id]).filter(Boolean).sort((a, b) => overall(a) - overall(b))[0];
      return !worst || overall(player) > overall(worst) + 1;
    }
    const pen = team.active.map((id) => state.players[id]).filter((p) => p && p.role === "RP");
    const worst = pen.sort((a, b) => overall(a) - overall(b))[0];
    return !worst || overall(player) > overall(worst) + 2;
  }
  const slot = team.lineup.find((s) => s.pos === player.pos);
  const cur = slot ? state.players[slot.id] : null;
  return !cur || overall(player) > overall(cur) + 1;
}

function signFreeAgent(state, team, player, years, salary) {
  state.freeAgents = state.freeAgents.filter((id) => id !== player.id);
  player.contract = { years, salary: round1(salary), type: "fa" };
  player.teamId = team.id;
  player.scoutNoise = team.id === state.userTeamId ? 0 : Math.max(4, player.scoutNoise || 8);
  if (team.active.length < ACTIVE_MAX) team.active.push(player.id);
  else team.farm.push(player.id);
}

function aiBid(state, rng, team) {
  const styleRoom = team.owner.style === "win-now" ? 1.12 : team.owner.style === "cheap" ? 0.98 : 1.05;
  const room = team.budget * styleRoom - payrollOf(state, team);
  if (room < MIN_SALARY) return null;
  const fas = state.freeAgents.map((id) => state.players[id]).filter(Boolean).sort((a, b) => talentWar(b) - talentWar(a));
  for (const p of fas) {
    if (!teamNeeds(state, team, p) && talentWar(p) < 2.2) continue;
    const offer = round1(Math.min(room, Math.max(MIN_SALARY, p.demand * rng.float(0.92, 1.06))));
    if (offer + 0.05 < p.demand * 0.9) continue;
    return { playerId: p.id, years: Math.min(p.demandYears || 1, p.age >= 33 ? 2 : 4), salary: offer };
  }
  return null;
}

export function placeFaBid(state, playerId, years, salary) {
  if (state.phase !== "free_agency") return { ok: false, message: "Free agency is closed." };
  const p = state.players[playerId];
  if (!p || p.teamId) return { ok: false, message: "That player is not on the market." };
  const y = clamp(Math.round(Number(years) || 1), 1, 6);
  const s = round1(Math.max(MIN_SALARY, Number(salary) || MIN_SALARY));
  state.faBids[playerId] = { years: y, salary: s };
  state.flash = `Offer filed for ${fullName(p)}: ${y}y / ${fmtMoney(s)}.`;
  return { ok: true, message: state.flash };
}

export function advanceFreeAgency(state) {
  if (state.phase !== "free_agency") return { ok: false, message: "The market is not open." };
  return mutate(state, (rng) => {
    const offers = {};
    for (const team of state.teams) {
      if (team.id === state.userTeamId) continue;
      const bid = aiBid(state, rng, team);
      if (bid) (offers[bid.playerId] ||= []).push({ ...bid, teamId: team.id });
    }
    for (const [playerId, bid] of Object.entries(state.faBids || {})) {
      (offers[playerId] ||= []).push({ ...bid, teamId: state.userTeamId, playerId });
    }
    const signed = [];
    for (const [playerId, list] of Object.entries(offers)) {
      const p = state.players[playerId];
      if (!p || p.teamId) continue;
      list.sort((a, b) => (b.salary * Math.max(1, b.years)) - (a.salary * Math.max(1, a.years)));
      const best = list[0];
      if (best.salary + 0.05 >= p.demand * 0.9) {
        signFreeAgent(state, teamById(state, best.teamId), p, best.years, best.salary);
        signed.push({ player: p, teamId: best.teamId, salary: best.salary, years: best.years });
        if (best.teamId === state.userTeamId && best.salary < marketSalary(p) * 0.62 && talentWar(p) >= 1.8) {
          state.meta.bargain = true;
        }
      }
    }
    for (const id of [...state.freeAgents]) {
      const p = state.players[id];
      if (!p) continue;
      p.demand = round1(Math.max(MIN_SALARY, p.demand * 0.9));
    }
    state.faBids = {};
    state.faWeek += 1;
    ensureRosters(state, rng);
    if (state.faWeek >= 4) {
      buildDraft(state, rng);
      state.flash = "Free agency closes. The draft room is open.";
    } else {
      const mine = signed.filter((s) => s.teamId === state.userTeamId);
      state.flash = mine.length ? `You sign ${mine.map((s) => s.player.last).join(", ")}.` : "Another week of the market passes.";
    }
    for (const s of signed) {
      if (s.teamId === state.userTeamId) {
        pushNews(state, {
          kind: "sign",
          title: `${s.player.last} signs`,
          body: `${fullName(s.player)} joins ${userTeam(state).city} for ${s.years} years at ${fmtMoney(s.salary)}.`,
        });
      }
    }
    checkAchievements(state);
    return { ok: true, message: state.flash };
  });
}

function draftOrder(state) {
  return state.teams.slice().sort((a, b) => {
    if (a.wins !== b.wins) return a.wins - b.wins;
    if (a.losses !== b.losses) return b.losses - a.losses;
    return a.id < b.id ? -1 : 1;
  }).map((t) => t.id);
}

function buildDraft(state, rng) {
  const order = draftOrder(state);
  const picks = [];
  let overallPick = 1;
  for (let round = 1; round <= 3; round++) {
    for (const teamId of order) picks.push({ round, overall: overallPick++, teamId, playerId: null, supplemental: false });
    if (round === 1 && state.situation === "rebuild") {
      picks.push({ round: 1, overall: overallPick++, teamId: state.userTeamId, playerId: null, supplemental: true });
    }
  }
  const used = new Set(Object.values(state.players).map((p) => `${p.first} ${p.last}`));
  const idRef = { n: state.nextId };
  const pool = [];
  const positions = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "SP", "SP", "RP", "RP"];
  for (let i = 0; i < 96; i++) {
    const p = createPlayer(rng, {
      pos: rng.pick(positions),
      age: rng.intRange(18, 21),
      farm: true,
      center: rng.intRange(34, 48),
      teamId: null,
      noise: 0,
    }, used, idRef);
    p.teamId = null;
    p.scoutNoise = clamp(scoutStart(state) - state.staff.scouting * 0.75, 1.2, 18);
    if (i < 5) p.potential = clamp(p.potential + rng.intRange(6, 12), 55, 80);
    state.players[p.id] = p;
    pool.push(p.id);
  }
  state.nextId = idRef.n;
  state.draft = { picks, pool, cursor: 0, year: state.year };
  state.phase = "draft";
}

function currentPick(state) {
  const d = state.draft;
  if (!d) return null;
  return d.picks.find((p) => !p.playerId) || null;
}

function assignPick(state, pick, playerId) {
  const p = state.players[playerId];
  const team = teamById(state, pick.teamId);
  pick.playerId = playerId;
  state.draft.pool = state.draft.pool.filter((id) => id !== playerId);
  p.teamId = team.id;
  p.drafted = { year: state.year, teamId: team.id, round: pick.round, overall: pick.overall };
  p.scoutNoise = team.id === state.userTeamId ? 0 : p.scoutNoise;
  team.farm.push(p.id);
  if (team.id === state.userTeamId && p.potential >= 70) state.meta.cantMiss = true;
  state.draft.cursor += 1;
}

function aiSelectProspect(state, rng, teamId) {
  const team = teamById(state, teamId);
  let best = null;
  let bestScore = -999;
  const sharp = state.difficulty === "sharp" ? 0.45 : 1;
  for (const id of state.draft.pool) {
    const p = state.players[id];
    let score = p.potential + overall(p) * 0.3 + rng.float(-7, 7) * sharp;
    if (teamNeeds(state, team, p)) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export function draftSelect(state, playerId) {
  if (state.phase !== "draft") return { ok: false, message: "The draft is closed." };
  const pick = currentPick(state);
  if (!pick || pick.teamId !== state.userTeamId) return { ok: false, message: "You are not on the clock." };
  if (!state.draft.pool.includes(playerId)) return { ok: false, message: "That player is off the board." };
  return mutate(state, () => {
    assignPick(state, pick, playerId);
    const p = state.players[playerId];
    pushNews(state, {
      kind: "draft",
      title: `${userTeam(state).city} drafts ${p.last}`,
      body: `Round ${pick.round}, pick ${pick.overall}: ${fullName(p)}, ${p.pos}.`,
    });
    if (!currentPick(state)) state.phase = "camp";
    state.flash = `You select ${fullName(p)}.`;
    checkAchievements(state);
    return { ok: true, message: state.flash };
  });
}

export function advanceDraftCpu(state) {
  if (state.phase !== "draft") return { ok: false, message: "The draft is closed." };
  return mutate(state, (rng) => {
    let guard = 0;
    while (guard++ < 90) {
      const pick = currentPick(state);
      if (!pick) {
        state.phase = "camp";
        state.flash = "The draft is complete.";
        return { ok: true, message: state.flash, onClock: false };
      }
      if (pick.teamId === state.userTeamId) {
        state.flash = `You are on the clock. Round ${pick.round}, pick ${pick.overall}.`;
        return { ok: true, message: state.flash, onClock: true };
      }
      const id = aiSelectProspect(state, rng, pick.teamId);
      if (!id) break;
      assignPick(state, pick, id);
    }
    return { ok: true, message: state.flash || "The board moves." };
  });
}

export function draftBestAvailable(state) {
  if (state.phase !== "draft") return { ok: false, message: "The draft is closed." };
  const ranked = (state.draft?.pool || []).slice().sort((a, b) => boardScore(state, b) - boardScore(state, a));
  if (!ranked.length) return { ok: false, message: "The board is empty." };
  return draftSelect(state, ranked[0]);
}

function boardScore(state, id) {
  const p = state.players[id];
  const pot = displayGrade(p, "potential", state.year, state.userTeamId).value;
  return pot * 1.35 + shownOverall(state, p) * 0.25;
}

export function shownOverall(state, p) {
  if (!p) return 0;
  if (p.teamId === state.userTeamId || (p.scoutNoise ?? 10) < 1.5) return overall(p);
  if (p.isPitcher) {
    const s = displayGrade(p, "stuff", state.year, state.userTeamId).value;
    const c = displayGrade(p, "control", state.year, state.userTeamId).value;
    const m = displayGrade(p, "movement", state.year, state.userTeamId).value;
    const st = displayGrade(p, "stamina", state.year, state.userTeamId).value;
    return clamp(Math.round(s * 0.42 + c * 0.28 + m * 0.22 + st * 0.08), 20, 80);
  }
  const vals = ["contact", "power", "eye", "speed", "defense", "arm"].map((k) => displayGrade(p, k, state.year, state.userTeamId).value);
  return clamp(Math.round(vals.reduce((s, n) => s + n, 0) / vals.length), 20, 80);
}

function developPlayer(state, rng, p) {
  const own = p.teamId === state.userTeamId;
  const focused = own && (state.focus || []).includes(p.id);
  const dev = own ? state.staff.development : 4;
  const rate = (0.1 + dev * 0.03) * (focused ? 1.9 : 1);
  const tools = p.isPitcher ? ["stuff", "control", "movement", "stamina"] : ["contact", "power", "eye", "speed", "defense", "arm"];
  if (p.age <= 25) {
    for (const key of tools) {
      if (p[key] < p.potential) {
        p[key] = clamp(Math.round(p[key] + rng.float(0, rate * Math.max(1, p.potential - p[key]) / 5)), 20, 80);
      }
    }
    if (focused) {
      let key = tools[0];
      let gap = -1;
      for (const tool of tools) {
        const room = (p.potential || 0) - p[tool];
        if (room > gap) {
          gap = room;
          key = tool;
        }
      }
      if (gap > 0) p[key] = clamp(p[key] + 1, 20, 80);
    }
  } else if (p.age >= 32) {
    for (const key of ["speed", "stamina", "stuff", "power"]) {
      if (p[key] > 20) p[key] = clamp(Math.round(p[key] - rng.float(0, 1.3 + (p.age - 32) * 0.28)), 20, 80);
    }
  } else if (rng.chance(0.45)) {
    const key = rng.pick(tools);
    p[key] = clamp(Math.round(p[key] + rng.float(-1.4, 1.4)), 20, 80);
  }
  if (p.age >= 34) p.durability = clamp(p.durability - 1, 25, 80);
}

function shouldRetire(rng, p) {
  if (p.age >= 42) return true;
  if (p.age >= 37 && rng.chance((p.age - 36) * 0.24)) return true;
  if (p.age >= 32 && overall(p) < 38 && rng.chance(0.5)) return true;
  if (!p.teamId && p.age >= 30 && overall(p) < 44 && rng.chance(0.4)) return true;
  return false;
}

function retirePlayer(state, p) {
  p.retired = true;
  makeFreeAgent(state, p);
  state.freeAgents = state.freeAgents.filter((id) => id !== p.id);
  p.teamId = null;
}

function noteGrowth(state, before) {
  const rose = [];
  const fell = [];
  for (const p of rosterPlayers(state, userTeam(state))) {
    if (before[p.id] == null) continue;
    const now = overall(p);
    const delta = now - before[p.id];
    if (delta >= 2) rose.push({ id: p.id, name: fullName(p), from: before[p.id], to: now });
    else if (delta <= -2) fell.push({ id: p.id, name: fullName(p), from: before[p.id], to: now });
  }
  rose.sort((a, b) => (b.to - b.from) - (a.to - a.from));
  fell.sort((a, b) => (a.to - a.from) - (b.to - b.from));
  state.growth = { year: state.year, rose: rose.slice(0, 5), fell: fell.slice(0, 4) };
}

function appendGrowth(state) {
  const g = state.growth;
  if (!g || !state.paper) return;
  const rose = g.rose.slice(0, 3).map((row) => `${row.name} (${row.from} to ${row.to})`).join(", ");
  const fell = g.fell.slice(0, 2).map((row) => row.name).join(", ");
  const slate = (state.focus || []).map((id) => state.players[id]).filter(Boolean).map((p) => p.last);
  const bits = [];
  if (rose) bits.push(`${rose} took a step over the winter.`);
  if (fell) bits.push(`${fell} lost a step.`);
  if (slate.length) bits.push(`The development slate is ${slate.join(" and ")}.`);
  if (!bits.length) bits.push("The winter was quiet. Nobody on the roster jumped a grade.");
  state.paper.body = `${state.paper.body} ${bits.join(" ")}`;
}

export function openCamp(state) {
  if (state.phase !== "camp") return { ok: false, message: "Finish the draft before camp." };
  if (!employed(state)) return { ok: false, message: "The career is over." };
  return mutate(state, (rng) => {
    const before = {};
    for (const p of rosterPlayers(state, userTeam(state))) before[p.id] = overall(p);
    for (const p of Object.values(state.players)) {
      if (p.retired) continue;
      if (!p.teamId && !state.freeAgents.includes(p.id)) continue;
      p.age += 1;
      developPlayer(state, rng, p);
      if (shouldRetire(rng, p)) retirePlayer(state, p);
    }
    for (const id of [...(state.draft?.pool || [])]) {
      const p = state.players[id];
      if (p && !p.teamId) p.retired = true;
    }
    state.draft = null;
    ensureRosters(state, rng);
    beginYear(state, rng, true);
    noteGrowth(state, before);
    appendGrowth(state);
    state.flash = `${state.year} camp is open in ${userTeam(state).city}.`;
    return { ok: true, message: state.flash };
  });
}

export function openSeason(state) {
  if (state.phase !== "preseason") return { ok: false, message: "You are not in camp." };
  if (!employed(state)) return { ok: false, message: "The career is over." };
  return mutate(state, (rng) => {
    ensureRosters(state, rng);
    state.staffLocked = true;
    state.phase = "season";
    state.inbox = state.inbox.map((item) => (item.resolved ? item : { ...item, resolved: item.kind === "camp" ? true : item.resolved }));
    const team = userTeam(state);
    state.flash = `Opening Day at ${team.parkName}.`;
    writePaper(state, `${team.city} opens the year`, openingOpponent(state), `${team.owner.name} will judge you on the goals pinned above the desk.`);
    return { ok: true, message: state.flash };
  });
}

function validateTrade(state, theirId, sendIds, recvIds, cashSend, cashRecv) {
  if (!employed(state)) return { ok: false, message: "The career is over." };
  if (state.phase === "season" && state.week >= DEADLINE_WEEK) return { ok: false, message: "The deadline has passed." };
  if (!["preseason", "season"].includes(state.phase)) return { ok: false, message: "The wires are closed." };
  const them = teamById(state, theirId);
  if (!them || them.id === state.userTeamId) return { ok: false, message: "Pick another club." };
  if (!sendIds.length || !recvIds.length) return { ok: false, message: "Both sides need a player." };
  if (sendIds.length > 4 || recvIds.length > 4) return { ok: false, message: "Keep the package to four players a side." };
  const user = userTeam(state);
  for (const id of sendIds) {
    const p = state.players[id];
    if (!p || p.teamId !== user.id) return { ok: false, message: "One of those players is not yours." };
  }
  for (const id of recvIds) {
    const p = state.players[id];
    if (!p || p.teamId !== them.id) return { ok: false, message: "One of those players is not theirs." };
  }
  if (new Set([...sendIds, ...recvIds]).size !== sendIds.length + recvIds.length) {
    return { ok: false, message: "That package lists a player twice." };
  }
  if (cashSend < 0 || cashRecv < 0 || cashSend > 12 || cashRecv > 12) return { ok: false, message: "Cash in a deal stays under $12M." };
  if (cashSend && cashRecv) return { ok: false, message: "Only one side sends cash." };
  return { ok: true };
}

function executeTrade(state, rng, theirId, sendIds, recvIds, cashSend, cashRecv) {
  const user = userTeam(state);
  const them = teamById(state, theirId);
  const sent = sendIds.map((id) => state.players[id]);
  const got = recvIds.map((id) => state.players[id]);
  for (const p of sent) {
    for (const team of state.teams) {
      team.active = team.active.filter((id) => id !== p.id);
      team.farm = team.farm.filter((id) => id !== p.id);
      team.lineup = team.lineup.filter((s) => s.id !== p.id);
      team.rotation = team.rotation.filter((id) => id !== p.id);
    }
    p.teamId = them.id;
    p.scoutNoise = Math.max(p.scoutNoise || 0, 8);
    p.onBlock = false;
    (them.active.length < ACTIVE_MAX ? them.active : them.farm).push(p.id);
  }
  for (const p of got) {
    for (const team of state.teams) {
      team.active = team.active.filter((id) => id !== p.id);
      team.farm = team.farm.filter((id) => id !== p.id);
      team.lineup = team.lineup.filter((s) => s.id !== p.id);
      team.rotation = team.rotation.filter((id) => id !== p.id);
    }
    p.teamId = user.id;
    p.scoutNoise = 0;
    p.onBlock = false;
    (user.active.length < ACTIVE_MAX ? user.active : user.farm).push(p.id);
  }
  state.books.cashOut += cashSend;
  state.books.cashIn += cashRecv;
  if (sent.length + got.length >= 4) state.meta.blockbuster = true;
  state.meta.fireSale += sent.filter((p) => p.age >= 30).length;
  if (state.meta.fireSale >= 3) state.meta.fireSaleYear = state.year;
  if (cashSend > cashRecv || got.some((p) => p.age >= 29 && talentWar(p) > 1)) state.meta.buyer = true;
  ensureRosters(state, rng);
  pushNews(state, {
    kind: "trade",
    title: `Trade with ${them.city}`,
    body: `${user.city} sends ${sent.map((p) => p.last).join(", ")} to ${them.city} for ${got.map((p) => p.last).join(", ")}.`,
  });
}

export function submitTrade(state, theirId, sendIds, recvIds, cashSend = 0, cashRecv = 0) {
  const check = validateTrade(state, theirId, sendIds, recvIds, Number(cashSend) || 0, Number(cashRecv) || 0);
  if (!check.ok) return check;
  return mutate(state, (rng) => {
    const edge = tradeEdge(state, theirId, sendIds, recvIds, Number(cashSend) || 0, Number(cashRecv) || 0);
    const noise = rng.float(-0.7, 0.7) * (state.staff.analytics >= 6 ? 0.3 : 1);
    const thresh = state.difficulty === "lenient" ? -0.35 : state.difficulty === "sharp" ? 1.15 : 0.4;
    if (edge + noise < thresh) {
      state.flash = "They hang up. The package is short.";
      return { ok: false, message: state.flash };
    }
    executeTrade(state, rng, theirId, sendIds, recvIds, Number(cashSend) || 0, Number(cashRecv) || 0);
    state.flash = "The trade is agreed.";
    checkAchievements(state);
    return { ok: true, message: state.flash };
  });
}

export function tradePreview(state, theirId, sendIds, recvIds, cashSend = 0, cashRecv = 0) {
  const check = validateTrade(state, theirId, sendIds || [], recvIds || [], Number(cashSend) || 0, Number(cashRecv) || 0);
  if (!check.ok) return { ...check, lean: "Incomplete", edge: 0, userGain: 0 };
  const edge = tradeEdge(state, theirId, sendIds, recvIds, Number(cashSend) || 0, Number(cashRecv) || 0);
  const fuzz = state.staff.analytics >= 6 ? 0 : ((sendIds.join("").length + recvIds.join("").length) % 5) * 0.15 - 0.3;
  const shown = edge + fuzz;
  let lean = "Toss-up";
  if (shown > 1.15) lean = "They should listen";
  else if (shown < -0.25) lean = "They will hang up";
  const userGain = recvIds.reduce((s, id) => s + surplusValue(state.players[id]), 0)
    - sendIds.reduce((s, id) => s + surplusValue(state.players[id]), 0)
    + ((Number(cashRecv) || 0) - (Number(cashSend) || 0)) * 0.45;
  return { ok: true, lean, edge: shown, userGain };
}

export function respondInbox(state, inboxId, choice) {
  const item = state.inbox.find((i) => i.id === inboxId);
  if (!item || item.resolved) return { ok: false, message: "That note is already filed." };
  if (item.kind === "info") {
    item.resolved = true;
    return { ok: true, message: "Filed." };
  }
  if (item.kind === "camp") {
    const id = choice === "b" ? item.bId : item.aId;
    const team = userTeam(state);
    const other = choice === "b" ? item.aId : item.bId;
    team.rotation = team.rotation.filter((pid) => pid !== other);
    if (!team.rotation.includes(id)) team.rotation.push(id);
    team.rotation = team.rotation.slice(0, 5);
    if (!team.rotation.includes(id)) {
      team.rotation[4] = id;
    }
    team.rotationCustom = true;
    item.resolved = true;
    state.flash = `${state.players[id].last} gets the ball.`;
    return { ok: true, message: state.flash };
  }
  if (item.kind === "callup") return answerCallup(state, item, choice);
  if (item.kind === "playing") return answerPlaying(state, item, choice);
  if (item.kind === "claim") {
    if (choice !== "accept") {
      item.resolved = true;
      state.flash = "You pass on the claim.";
      return { ok: true, message: state.flash };
    }
    return mutate(state, (rng) => answerClaim(state, rng, item));
  }
  if (item.kind === "owner") {
    if (choice === "accept") {
      const team = userTeam(state);
      const p = state.players[item.playerId];
      if (p && p.teamId === team.id && !p.isPitcher) {
        const pos = FIELD_POSITIONS.find((posName) => posName !== "DH" && canPlay(p, posName)) || p.pos || "DH";
        const slot = team.lineup.find((s) => s.pos === pos) || team.lineup[0];
        if (slot) slot.id = p.id;
        if (!lineupValid(state, team)) autoLineup(state, team);
        p.morale = clamp(p.morale + 6, 20, 95);
      }
      noteSecurity(state, 3);
      item.resolved = true;
      state.flash = "You make the change. The box is pleased.";
      return { ok: true, message: state.flash };
    }
    noteSecurity(state, -4);
    item.resolved = true;
    state.flash = "You decline. The owner remembers.";
    return { ok: true, message: state.flash };
  }
  if (item.kind === "trade") {
    if (choice !== "accept") {
      item.resolved = true;
      state.flash = "You pass.";
      return { ok: true, message: state.flash };
    }
    const offer = item.offer;
    const check = validateTrade(state, offer.teamId, offer.send, offer.recv, offer.cashSend, offer.cashRecv);
    if (!check.ok) {
      item.resolved = true;
      return check;
    }
    return mutate(state, (rng) => {
      executeTrade(state, rng, offer.teamId, offer.send, offer.recv, offer.cashSend || 0, offer.cashRecv || 0);
      item.resolved = true;
      state.flash = "You accept the call.";
      checkAchievements(state);
      return { ok: true, message: state.flash };
    });
  }
  item.resolved = true;
  return { ok: true, message: "Filed." };
}

function answerCallup(state, item, choice) {
  const team = userTeam(state);
  const p = state.players[item.playerId];
  item.resolved = true;
  if (!p || p.teamId !== team.id || !team.farm.includes(p.id)) {
    return { ok: false, message: "He is no longer on the farm." };
  }
  if (choice !== "accept") {
    p.morale = clamp(p.morale - 7, 20, 95);
    state.flash = `${p.last} heard the no.`;
    return { ok: true, message: state.flash };
  }
  if (team.active.length >= ACTIVE_MAX) {
    const repl = state.players[item.replaceId];
    let sent = repl && team.active.includes(repl.id) ? demote(state, repl.id) : { ok: false };
    if (!sent.ok) {
      const spare = team.active
        .map((id) => state.players[id])
        .filter((q) => q && q.isPitcher === p.isPitcher && !team.lineup.some((s) => s.id === q.id) && !team.rotation.includes(q.id))
        .sort((a, b) => overall(a) - overall(b))[0];
      sent = spare ? demote(state, spare.id) : { ok: false };
    }
    if (!sent.ok) return { ok: false, message: "The active roster has no open chair." };
  }
  const up = promote(state, p.id);
  if (!up.ok) return up;
  p.morale = clamp(p.morale + 6, 20, 95);
  pushNews(state, {
    kind: "roster",
    title: `${p.last} is called up`,
    body: `${fullName(p)} joins the active roster.`,
  });
  state.flash = `${fullName(p)} is up.`;
  return { ok: true, message: state.flash };
}

function answerPlaying(state, item, choice) {
  const team = userTeam(state);
  const p = state.players[item.playerId];
  item.resolved = true;
  if (!p || !team.active.includes(p.id)) return { ok: false, message: "He is not available." };
  if (choice !== "accept") {
    p.morale = clamp(p.morale - 6, 20, 95);
    state.flash = `${p.last} will sit, and he knows it.`;
    return { ok: true, message: state.flash };
  }
  if (p.injuredWeeks) return { ok: false, message: `${p.last} is hurt.` };
  const slot = team.lineup[item.slot];
  if (!slot) return { ok: false, message: "The card has moved." };
  const oldId = slot.id;
  const other = team.lineup.find((s) => s.id === p.id);
  if (other) other.id = oldId;
  slot.id = p.id;
  if (!lineupValid(state, team)) {
    slot.id = oldId;
    if (other) other.id = p.id;
    return { ok: false, message: "The staff cannot make that card legal." };
  }
  team.lineupCustom = true;
  p.morale = clamp(p.morale + 7, 20, 95);
  state.flash = `${p.last} is in the lineup.`;
  return { ok: true, message: state.flash };
}

function answerClaim(state, rng, item) {
  const team = userTeam(state);
  const p = state.players[item.playerId];
  item.resolved = true;
  if (!p || !p.teamId || p.teamId === team.id) return { ok: false, message: "That player is no longer available." };
  if (team.farm.length >= FARM_MAX && team.active.length >= ACTIVE_MAX) {
    return { ok: false, message: "There is no roster spot for a claim." };
  }
  const them = teamById(state, p.teamId);
  for (const club of state.teams) {
    club.active = club.active.filter((id) => id !== p.id);
    club.farm = club.farm.filter((id) => id !== p.id);
    club.lineup = club.lineup.filter((s) => s.id !== p.id);
    club.rotation = club.rotation.filter((id) => id !== p.id);
  }
  p.teamId = team.id;
  p.scoutNoise = 0;
  p.onBlock = false;
  if (team.farm.length < FARM_MAX) team.farm.push(p.id);
  else team.active.push(p.id);
  state.books.cashOut += Number(item.fee) || 0.4;
  ensureRosters(state, rng);
  pushNews(state, {
    kind: "trade",
    title: `${team.city} claims ${p.last}`,
    body: `${fullName(p)} comes over from ${them?.city || "another club"} on a ${fmtMoney(Number(item.fee) || 0.4)} claim.`,
  });
  state.flash = `${p.last} is yours.`;
  return { ok: true, message: state.flash };
}

export function setLineup(state, entries) {
  const team = userTeam(state);
  if (!Array.isArray(entries) || entries.length !== 9) return { ok: false, message: "A lineup needs nine names." };
  const seen = new Set();
  const poss = new Set();
  for (const slot of entries) {
    const p = state.players[slot.id];
    if (!p || p.teamId !== team.id || p.isPitcher) return { ok: false, message: "Every spot needs a hitter in the organization." };
    if (!team.active.includes(p.id)) return { ok: false, message: `${fullName(p)} is not on the active roster.` };
    if (p.injuredWeeks) return { ok: false, message: `${fullName(p)} is hurt.` };
    if (seen.has(p.id) || poss.has(slot.pos) || !FIELD_POSITIONS.includes(slot.pos)) {
      return { ok: false, message: "Positions have to be the eight fielders plus a DH, each once." };
    }
    seen.add(p.id);
    poss.add(slot.pos);
  }
  team.lineup = entries.map((s) => ({ id: s.id, pos: s.pos }));
  team.lineupCustom = true;
  state.flash = "Lineup card updated.";
  return { ok: true, message: state.flash };
}

export function setRotation(state, ids) {
  const team = userTeam(state);
  if (!Array.isArray(ids) || ids.length !== 5) return { ok: false, message: "Name five starters." };
  const seen = new Set();
  for (const id of ids) {
    const p = state.players[id];
    if (!p || !p.isPitcher || p.teamId !== team.id || !team.active.includes(id) || seen.has(id)) {
      return { ok: false, message: "The rotation needs five active pitchers." };
    }
    if (p.injuredWeeks) return { ok: false, message: `${fullName(p)} is hurt.` };
    seen.add(id);
  }
  team.rotation = ids.slice();
  team.rotationCustom = true;
  state.flash = "Rotation set.";
  return { ok: true, message: state.flash };
}

export function autoSetLineup(state) {
  const bias = state.posture === "bridge" ? "bridge" : "";
  autoLineup(state, userTeam(state), bias);
  state.flash = bias ? "The staff sets the card. Close calls went to the younger player." : "The staff sets the card.";
  return { ok: true, message: state.flash };
}

export function autoSetRotation(state) {
  const bias = state.posture === "bridge" ? "bridge" : "";
  autoRotation(state, userTeam(state), bias);
  state.flash = bias ? "The staff sorts the arms. Close calls went to the younger pitcher." : "The staff sorts the rotation.";
  return { ok: true, message: state.flash };
}

export function setBlock(state, playerId, on) {
  const p = state.players[playerId];
  const team = userTeam(state);
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not yours." };
  p.onBlock = !!on;
  state.flash = on ? `${p.last} is available.` : `${p.last} is off the block.`;
  return { ok: true, message: state.flash };
}

export function promote(state, playerId) {
  const team = userTeam(state);
  const p = state.players[playerId];
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not in the organization." };
  if (team.active.includes(p.id)) return { ok: false, message: "Already active." };
  if (team.active.length >= ACTIVE_MAX) return { ok: false, message: "The active roster is full. Demote someone first." };
  team.farm = team.farm.filter((id) => id !== p.id);
  team.active.push(p.id);
  state.flash = `${fullName(p)} is called up.`;
  return { ok: true, message: state.flash };
}

export function demote(state, playerId) {
  const team = userTeam(state);
  const p = state.players[playerId];
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not in the organization." };
  if (!team.active.includes(p.id)) return { ok: false, message: "Already on the farm." };
  if (team.farm.length >= FARM_MAX) return { ok: false, message: "The farm is full." };
  const hitters = team.active.filter((id) => !state.players[id].isPitcher).length;
  const arms = team.active.filter((id) => state.players[id].isPitcher).length;
  if (!p.isPitcher && hitters <= 9) return { ok: false, message: "You need nine active hitters." };
  if (p.isPitcher && arms <= 8) return { ok: false, message: "You need eight active pitchers." };
  team.active = team.active.filter((id) => id !== p.id);
  team.lineup = team.lineup.filter((s) => s.id !== p.id);
  team.rotation = team.rotation.filter((id) => id !== p.id);
  team.farm.push(p.id);
  if (!lineupValid(state, team)) autoLineup(state, team);
  if (team.rotation.length < 5) autoRotation(state, team);
  state.flash = `${fullName(p)} is sent down.`;
  return { ok: true, message: state.flash };
}

export function releasePlayer(state, playerId) {
  const team = userTeam(state);
  const p = state.players[playerId];
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not yours." };
  const hitters = [...team.active, ...team.farm].filter((id) => !state.players[id].isPitcher).length;
  const arms = [...team.active, ...team.farm].filter((id) => state.players[id].isPitcher).length;
  if (!p.isPitcher && hitters <= 13) return { ok: false, message: "The organization needs its hitters." };
  if (p.isPitcher && arms <= 12) return { ok: false, message: "The organization needs its arms." };
  const dead = p.service >= 3 ? (p.contract?.salary || 0) * Math.max(0, p.contract?.years || 0) * 0.75 : 0;
  state.books.dead += dead;
  makeFreeAgent(state, p);
  p.contract = { years: 0, salary: 0, type: "fa" };
  pushNews(state, {
    kind: "roster",
    title: `${p.last} is released`,
    body: dead ? `${fullName(p)} is released. ${fmtMoney(dead)} stays on the books.` : `${fullName(p)} is released.`,
  });
  state.flash = dead ? `Released. Dead money ${fmtMoney(dead)}.` : "Released.";
  return mutate(state, (rng) => {
    ensureRosters(state, rng);
    return { ok: true, message: state.flash };
  });
}

export function offerExtension(state, playerId, years, salary) {
  const p = state.players[playerId];
  const team = userTeam(state);
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not yours." };
  const y = clamp(Math.round(Number(years) || 0), 1, 6);
  const s = round1(Math.max(MIN_SALARY, Number(salary) || 0));
  const ask = marketSalary(p) * (p.personality === "loyal" ? 0.9 : p.personality === "mercenary" ? 1.16 : 1.02);
  const g = team.wins + team.losses;
  const contending = g > 8 && team.wins / g >= 0.55;
  const ok = s >= ask * (contending ? 0.94 : 1) && y >= 2;
  if (!ok) {
    p.morale = clamp(p.morale - 3, 20, 95);
    state.flash = `${p.last} declines. The ask is about ${fmtMoney(ask)}.`;
    return { ok: false, message: state.flash, ask: round1(ask) };
  }
  p.contract = { years: y, salary: s, type: "extension" };
  p.morale = clamp(p.morale + 8, 20, 95);
  pushNews(state, { kind: "sign", title: `${p.last} extends`, body: `${fullName(p)} agrees to ${y} years at ${fmtMoney(s)}.` });
  state.flash = `${p.last} signs the extension.`;
  return { ok: true, message: state.flash, ask: round1(ask) };
}

function englishList(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function rosterBoard(state) {
  const team = userTeam(state);
  const active = (team?.active || []).map((id) => state.players[id]).filter(Boolean);
  const hitters = active.filter((p) => !p.isPitcher && !p.retired);
  const lineupIds = new Set((team?.lineup || []).map((slot) => slot.id));
  const spots = (team?.lineup || []).map((slot) => {
    const starter = state.players[slot.id];
    const backup = hitters
      .filter((p) => p.id !== slot.id && !p.injuredWeeks && canPlay(p, slot.pos))
      .sort((a, b) => overall(b) - overall(a))[0];
    const grade = starter ? overall(starter) : 0;
    return {
      pos: slot.pos,
      id: starter?.id || "",
      name: starter ? fullName(starter) : "Empty",
      overall: grade,
      backupId: backup?.id || "",
      backup: backup ? fullName(backup) : "",
      thin: !starter || grade < 48 || !backup,
    };
  });
  const thin = spots.filter((spot) => spot.thin).map((spot) => spot.pos);
  const spare = hitters
    .filter((p) => !lineupIds.has(p.id))
    .sort((a, b) => overall(b) - overall(a))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      name: fullName(p),
      pos: p.pos,
      overall: overall(p),
      onBlock: !!p.onBlock,
      years: p.contract?.years || 0,
    }));
  const clock = active
    .filter((p) => (p.contract?.years || 0) <= 1 && ((p.contract?.salary || 0) >= 2 || (p.service || 0) >= 5))
    .sort((a, b) => (b.contract?.salary || 0) - (a.contract?.salary || 0))
    .slice(0, 4)
    .map((p) => ({
      id: p.id,
      name: fullName(p),
      years: p.contract?.years || 0,
      salary: p.contract?.salary || 0,
    }));
  const kids = (team?.farm || [])
    .map((id) => state.players[id])
    .filter((p) => p && !p.retired && p.age <= 25)
    .sort((a, b) => (b.potential || 0) - (a.potential || 0) || overall(b) - overall(a));
  const kid = kids[0];
  const light = (team?.rotation || [])
    .map((id) => state.players[id])
    .filter((p) => p && overall(p) < 46);
  let line = thin.length ? `Thin at ${englishList(thin)}.` : "Every spot on the card has a body behind it.";
  if (light.length) line += ` Light arms: ${englishList(light.map((p) => p.last))}.`;
  return {
    spots,
    spare,
    clock,
    next: kid ? { id: kid.id, name: fullName(kid), age: kid.age, pos: kid.pos, potential: kid.potential } : null,
    line,
    posture: state.posture || "",
  };
}

export const POSTURES = [
  { id: "push", title: "Push", text: "Play the best card you have. The staff sorts by the present." },
  { id: "bridge", title: "Bridge", text: "When two players are close, the younger one gets the spot." },
  { id: "shop", title: "Shop", text: "The card stays put. Expiring deals off the card go on the block." },
];

function markShopSpares(state) {
  const team = userTeam(state);
  const keep = new Set([...(team.lineup || []).map((slot) => slot.id), ...(team.rotation || [])]);
  let marked = 0;
  for (const id of team.active) {
    const p = state.players[id];
    if (!p || keep.has(p.id) || p.age < 29 || (p.contract?.years || 0) > 1) continue;
    if (!p.onBlock) marked += 1;
    p.onBlock = true;
  }
  return marked;
}

export function setPosture(state, id) {
  if (state.staffLocked || !["preseason", "camp"].includes(state.phase)) {
    return { ok: false, message: "The posture locks on Opening Day." };
  }
  if (!POSTURES.some((row) => row.id === id)) return { ok: false, message: "Pick push, bridge, or shop." };
  state.posture = id;
  const named = POSTURES.find((row) => row.id === id);
  if (id === "shop") {
    const marked = markShopSpares(state);
    state.flash = marked
      ? `This year: Shop. ${marked} spare ${marked === 1 ? "part is" : "parts are"} on the block.`
      : "This year: Shop. No expiring spare parts to mark.";
  } else {
    state.flash = `This year: ${named.title}.`;
  }
  return { ok: true, message: state.flash };
}

export const PLANS = [
  { id: "bats", title: "Bats", text: "Extra swings. Contact and power tick up for this series." },
  { id: "arms", title: "Arms", text: "A pitching week. Stuff and command tick up for this series." },
  { id: "gloves", title: "Gloves", text: "Early work on the infield. The defense plays a little tighter." },
  { id: "rest", title: "Rest", text: "Shorter days. Fewer injuries, and the room stays fresher." },
];

export function setPlan(state, focus) {
  if (state.phase !== "season") return { ok: false, message: "The plan is for the regular season." };
  if (state.day > 0) return { ok: false, message: "The series is already underway." };
  if (!PLANS.some((plan) => plan.id === focus)) return { ok: false, message: "Pick bats, arms, gloves, or rest." };
  state.plan = { week: state.week, focus };
  const named = PLANS.find((plan) => plan.id === focus);
  state.flash = `This series: ${named.title}.`;
  return { ok: true, message: state.flash };
}

export function weekAgenda(state) {
  const items = [];
  const team = userTeam(state);
  const open = (state.inbox || []).filter((item) => !item.resolved);
  if (open.length) {
    items.push({
      id: "inbox",
      tone: "now",
      view: "desk",
      text: `${open.length} ${open.length === 1 ? "note is" : "notes are"} waiting on the desk`,
    });
  }
  const hurtLine = (team.lineup || []).map((slot) => state.players[slot.id]).filter((p) => p && p.injuredWeeks);
  const hurtArm = (team.rotation || []).map((id) => state.players[id]).filter((p) => p && p.injuredWeeks && !hurtLine.includes(p));
  const hurt = [...hurtLine, ...hurtArm];
  if (hurt.length) {
    items.push({
      id: "hurt",
      tone: "now",
      view: "roster",
      text: `${hurt.map((p) => p.last).join(", ")} ${hurt.length === 1 ? "is" : "are"} hurt and still on the card`,
    });
  }
  if (!state.staffLocked && ["preseason", "camp"].includes(state.phase) && (state.focus || []).length < 2) {
    items.push({
      id: "slate",
      tone: "soon",
      view: "roster",
      text: (state.focus || []).length ? "The development slate has one open chair" : "Name the development slate before Opening Day",
    });
  }
  if (state.phase === "tender" && Object.keys(state.tenders || {}).length) {
    const n = Object.keys(state.tenders).length;
    items.push({ id: "tenders", tone: "now", view: "market", text: `${n} ${n === 1 ? "tender is" : "tenders are"} waiting` });
  }
  if (state.phase === "free_agency") {
    items.push({ id: "market", tone: "soon", view: "market", text: "The market is open. Bid, or advance the week." });
  }
  if (state.phase === "draft") {
    const pick = state.draft?.picks?.find((row) => !row.playerId);
    if (pick?.teamId === state.userTeamId) {
      items.push({ id: "clock", tone: "now", view: "market", text: `You are on the clock. Round ${pick.round}.` });
    }
  }
  if (state.phase === "season" && state.day === 0 && state.plan?.week !== state.week) {
    items.push({ id: "plan", tone: "soon", view: "desk", text: "Name a plan before the series starts" });
  }
  if (!state.staffLocked && ["preseason", "camp"].includes(state.phase) && !state.posture) {
    items.push({ id: "posture", tone: "soon", view: "roster", text: "Name how you will build the club" });
  }
  if (!items.length) {
    items.push({ id: "clear", tone: "done", view: "", text: "The desk is clear." });
  }
  return items;
}

export function setFocus(state, playerId) {
  if (state.staffLocked || !["preseason", "camp"].includes(state.phase)) {
    return { ok: false, message: "The development slate locks on Opening Day." };
  }
  const p = state.players[playerId];
  const team = userTeam(state);
  if (!p || p.teamId !== team.id) return { ok: false, message: "That player is not in the organization." };
  if (!team.farm.includes(p.id)) return { ok: false, message: "The slate is for players still on the farm." };
  if (p.age > 25) return { ok: false, message: "The extra reps are for players 25 and under." };
  state.focus = state.focus || [];
  if (state.focus.includes(p.id)) {
    state.focus = state.focus.filter((id) => id !== p.id);
    state.flash = `${p.last} is off the slate.`;
    return { ok: true, message: state.flash };
  }
  if (state.focus.length >= 2) return { ok: false, message: "The slate holds two names. Take one off first." };
  state.focus.push(p.id);
  state.flash = `${fullName(p)} will get the extra reps.`;
  return { ok: true, message: state.flash };
}

export function setStaff(state, patch) {
  if (state.phase !== "preseason" || state.staffLocked) return { ok: false, message: "Staff plans lock on Opening Day." };
  for (const key of ["scouting", "development", "marketing", "analytics"]) {
    if (patch[key] != null) state.staff[key] = round1(clamp(Number(patch[key]) || 0, 0, 12));
  }
  state.flash = "Staff plan updated.";
  return { ok: true, message: state.flash };
}

export function markManualRead(state) {
  state.meta.readManual = true;
  checkAchievements(state);
  return { ok: true };
}

export function setTutorialSeen(state) {
  state.seenTutorial = true;
}

export function retireGm(state) {
  if (state.gm.fired) return { ok: false, message: "The owner already ended it." };
  if (state.gm.retired) return { ok: false, message: "You have already left." };
  state.gm.retired = true;
  state.phase = "legacy";
  state.letter = "You leave the chair on your own terms.";
  state.flash = state.letter;
  checkAchievements(state);
  return { ok: true, message: state.flash };
}

export function standings(state) {
  return ["Harbor", "Summit"].map((league) => {
    const teams = state.teams.filter((t) => t.league === league);
    const divisions = [...new Set(teams.map((t) => t.division))];
    return {
      league,
      divisions: divisions.map((division) => {
        const group = teams.filter((t) => t.division === division).sort(compareTeams);
        const leader = group[0];
        return {
          division,
          teams: group.map((t) => ({
            team: t,
            gb: t.id === leader.id ? 0 : ((leader.wins - t.wins) + (t.losses - leader.losses)) / 2,
          })),
        };
      }),
    };
  });
}

export function currentSeries(state) {
  if (!state.schedule?.[state.week]) return null;
  return state.schedule[state.week].find((g) => g.home === state.userTeamId || g.away === state.userTeamId) || null;
}

function bookFog(state, team) {
  const ids = team?.active || [];
  let n = 0;
  let sum = 0;
  for (const id of ids) {
    const p = state.players[id];
    if (!p) continue;
    n += 1;
    sum += p.scoutNoise || 0;
  }
  return n ? sum / n : 10;
}

function nextArm(state, team) {
  const order = team.rotation || [];
  const turn = team.rotationTurn || 0;
  for (let i = 0; i < order.length; i += 1) {
    const p = state.players[order[(turn + i) % order.length]];
    if (p && !p.injuredWeeks && !p.retired) return p;
  }
  return (team.active || []).map((id) => state.players[id]).find((p) => p && p.isPitcher && !p.injuredWeeks) || null;
}

function bestBat(state, team) {
  const ids = (team.lineup || []).map((slot) => slot.id);
  const pool = (ids.length ? ids : team.active || []).map((id) => state.players[id]).filter((p) => p && !p.isPitcher && !p.injuredWeeks && !p.retired);
  if (!pool.length) return null;
  return pool.slice().sort((a, b) => overall(b) - overall(a))[0];
}

function revealPlayer(p, fog, kind) {
  if (!p || fog >= 8) return null;
  const name = fog >= 3.5 ? p.last : fullName(p);
  const role = kind === "arm" ? (p.role === "SP" ? "Gets the ball" : "In the pen") : "The bat they trust";
  const detail = fog >= 3.5 ? role : `${role} · ${gradeLabel(overall(p))}`;
  return { id: p.id, name, detail };
}

function parkLine(park) {
  if (park >= 1.06) return "The park helps the bats.";
  if (park <= 0.95) return "The park helps the arms.";
  return "The park plays honest.";
}

function seriesGames(state, series) {
  const userId = state.userTeamId;
  const slots = series.results || [];
  return Array.from({ length: 4 }, (_, i) => {
    const box = slots[i];
    if (!box) return { n: i + 1, played: false, line: "" };
    const us = box.homeId === userId ? box.homeRuns : box.awayRuns;
    const them = box.homeId === userId ? box.awayRuns : box.homeRuns;
    const win = box.winner === userId;
    return { n: i + 1, played: true, win, line: `${win ? "W" : "L"} ${us}–${them}` };
  });
}

export function seriesBrief(state) {
  const series = currentSeries(state);
  if (!series) return null;
  const team = userTeam(state);
  const oppId = series.home === team.id ? series.away : series.home;
  const opp = teamById(state, oppId);
  const home = teamById(state, series.home);
  if (!opp || !home) return null;
  const fog = bookFog(state, opp);
  const played = opp.wins + opp.losses;
  const diff = opp.rs - opp.ra;
  const games = seriesGames(state, series);
  const next = games.some((g) => !g.played) ? nextArm(state, team) : null;
  return {
    opponentId: opp.id,
    where: series.home === team.id ? "Home" : "Road",
    parkName: home.parkName,
    parkLine: parkLine(home.park),
    record: played ? `${opp.wins}-${opp.losses}` : "No games yet",
    diff: played >= 4 ? diff : null,
    fog,
    played: games.filter((g) => g.played).length,
    games,
    yours: next ? { id: next.id, name: fullName(next) } : null,
    arm: revealPlayer(nextArm(state, opp), fog, "arm"),
    bat: revealPlayer(bestBat(state, opp), fog, "bat"),
    note: fog >= 8 ? "The book on them is still shut." : fog >= 3.5 ? "Scouting has a shape, not a grade." : "The book is open.",
  };
}

export function clubhouse(state) {
  const team = userTeam(state);
  const room = (team?.active || []).map((id) => state.players[id]).filter(Boolean);
  if (!room.length) return { morale: 55, sour: 0, line: "The room is empty.", voices: [] };
  const morale = room.reduce((sum, p) => sum + (p.morale || 55), 0) / room.length;
  const sour = room.filter((p) => (p.morale || 55) < 45).length;
  let line = "The room is even.";
  if (morale >= 70) line = "The room is sharp.";
  else if (morale < 52) line = "The room is restless.";
  if (sour >= 3) line += ` ${sour} players are sour.`;
  const ranked = room.slice().sort((a, b) => (a.morale || 55) - (b.morale || 55) || a.last.localeCompare(b.last));
  const low = ranked[0];
  const high = ranked[ranked.length - 1];
  const sourList = ranked.filter((p) => (p.morale || 55) < 45).slice(0, 3);
  const picked = sourList.length ? sourList.slice() : [low];
  if (high && !picked.some((p) => p.id === high.id)) picked.push(high);
  const voices = picked.map((p) => ({
    id: p.id,
    name: fullName(p),
    morale: Math.round(p.morale || 55),
    sour: (p.morale || 55) < 45,
  }));
  return { morale: Math.round(morale), sour, line, voices };
}

export function leaders(state) {
  const lg = leagueLines(state);
  const played = Math.max(1, ...state.teams.map((t) => t.wins + t.losses));
  const paCut = Math.max(10, played * 1.5);
  const ipCut = Math.max(9, played * 0.35) * 3;
  const rows = Object.values(state.players).filter((p) => !p.retired);
  const bat = rows.filter((p) => !p.isPitcher && p.season.bat.pa >= paCut);
  const pit = rows.filter((p) => p.isPitcher && p.season.pit.outs >= ipCut && p.role === "SP");
  const top = (list, score, n = 8) => list.slice().sort((a, b) => score(b) - score(a)).slice(0, n);
  return {
    avg: top(bat, (p) => p.season.bat.ab ? p.season.bat.h / p.season.bat.ab : 0),
    hr: top(rows.filter((p) => !p.isPitcher), (p) => p.season.bat.hr),
    rbi: top(rows.filter((p) => !p.isPitcher), (p) => p.season.bat.rbi),
    era: top(pit, (p) => -((p.season.pit.er * 27) / Math.max(1, p.season.pit.outs))),
    k: top(rows.filter((p) => p.isPitcher), (p) => p.season.pit.k),
    war: top(rows.filter((p) => p.season.bat.pa > 20 || p.season.pit.outs > 15), (p) => playerWar(p, lg)),
  };
}

export function userTeamOf(state) {
  return userTeam(state);
}

export function teamOf(state, id) {
  return teamById(state, id);
}

export function playerOf(state, id) {
  return state.players[id] || null;
}

export function audit(state) {
  const errors = [];
  const seen = new Map();
  for (const team of state.teams) {
    const ids = [...team.active, ...team.farm];
    if (new Set(ids).size !== ids.length) errors.push(`dup roster ${team.id}`);
    for (const id of ids) {
      if (seen.has(id)) errors.push(`shared ${id}`);
      seen.set(id, team.id);
      const p = state.players[id];
      if (!p) errors.push(`missing ${id}`);
      else if (p.teamId !== team.id) errors.push(`mismatch ${id}`);
      else if (p.retired) errors.push(`retired rostered ${id}`);
    }
    for (const slot of team.lineup) {
      if (!team.active.includes(slot.id)) errors.push(`lineup inactive ${team.id}`);
    }
    for (const id of team.rotation) {
      if (!team.active.includes(id)) errors.push(`rotation inactive ${team.id}`);
    }
    if (state.phase === "season" && team.lineup.length !== 9) errors.push(`lineup ${team.id} ${team.lineup.length}`);
  }
  for (const id of state.freeAgents) {
    const p = state.players[id];
    if (!p) errors.push(`fa missing ${id}`);
    else if (p.teamId) errors.push(`fa teamed ${id}`);
    if (seen.has(id)) errors.push(`fa rostered ${id}`);
  }
  const bad = Object.values(state.players).filter((p) => !Number.isFinite(p.contact) || !Number.isFinite(p.stuff));
  if (bad.length) errors.push("nan ratings");
  return errors;
}

export function leagueReport(state) {
  const lg = leagueLines(state);
  const games = state.teams.reduce((s, t) => s + t.wins, 0);
  const runs = state.teams.reduce((s, t) => s + t.rs, 0);
  return {
    avg: lg.ab ? lg.h / lg.ab : 0,
    obp: lg.pa ? (lg.h + lg.bb) / lg.pa : 0,
    hr: lg.hr,
    runs,
    games,
    rpg: games ? runs / (games * 2) : 0,
    era: lg.era,
    k: lg.pa ? 0 : 0,
    pa: lg.pa,
  };
}

export function simSeasonToRecap(state) {
  if (state.phase === "preseason") openSeason(state);
  if (state.phase === "season") simToOctober(state);
  if (state.phase === "playoffs") simRestOfOctober(state);
  return state;
}

export function autoUserBids(state) {
  if (state.phase !== "free_agency") return;
  const team = userTeam(state);
  const room = team.budget * 1.02 - payrollOf(state, team);
  const fas = state.freeAgents.map((id) => state.players[id]).filter((p) => p && teamNeeds(state, team, p));
  fas.sort((a, b) => talentWar(b) - talentWar(a));
  const pick = fas[0];
  if (!pick) return;
  const salary = round1(Math.min(room, Math.max(pick.demand, MIN_SALARY)));
  if (salary >= pick.demand * 0.95 && salary <= room) placeFaBid(state, pick.id, pick.demandYears || 2, salary);
}

function bestTrueProspect(state) {
  return (state.draft?.pool || []).slice().sort((a, b) => {
    const pa = state.players[a];
    const pb = state.players[b];
    return (pb.potential + overall(pb) * 0.2) - (pa.potential + overall(pa) * 0.2);
  })[0];
}

export function completeCpuYear(state) {
  if (!employed(state) && !state.cpu) return state;
  if (state.gm.fired) return state;
  simSeasonToRecap(state);
  if (state.gm.fired) return state;
  if (state.phase === "recap") ackRecap(state);
  if (state.phase === "tender") {
    for (const row of Object.values(state.tenders || {})) row.tender = true;
    fileTenders(state);
  }
  let guard = 0;
  while (state.phase === "free_agency" && guard++ < 6) {
    autoUserBids(state);
    advanceFreeAgency(state);
  }
  guard = 0;
  while (state.phase === "draft" && guard++ < 140) {
    const pick = currentPick(state);
    if (!pick) {
      state.phase = "camp";
      break;
    }
    if (pick.teamId === state.userTeamId) {
      const id = bestTrueProspect(state);
      if (id) draftSelect(state, id);
      else break;
    } else {
      const res = advanceDraftCpu(state);
      if (res && res.onClock) continue;
    }
  }
  if (state.phase === "camp") openCamp(state);
  return state;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function hydrate(raw) {
  const state = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!state || state.version !== SAVE_VERSION) {
    throw new Error("This save is from a different edition of Front Office Corner.");
  }
  if (!Array.isArray(state.focus)) state.focus = [];
  if (!Array.isArray(state.awardsLog)) state.awardsLog = [];
  if (state.growth == null) state.growth = null;
  if (!state.plan || typeof state.plan !== "object") state.plan = null;
  if (!["push", "bridge", "shop"].includes(state.posture)) state.posture = null;
  return state;
}

export function takeToasts(state) {
  const list = state.pendingToasts || [];
  state.pendingToasts = [];
  return list;
}
