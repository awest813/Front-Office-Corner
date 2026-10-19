import { ACHIEVEMENTS, achievementById } from "./achieve.js";
import {
  advanceDraftCpu,
  advanceFreeAgency,
  ackRecap,
  autoSetLineup,
  autoSetRotation,
  createCareer,
  currentSeries,
  demote,
  DIFFICULTIES,
  displayGrade,
  draftBestAvailable,
  draftSelect,
  fileTenders,
  GAME_VERSION,
  gradeLabel,
  hydrate,
  leaders,
  MANUAL,
  markManualRead,
  marketSalary,
  offerExtension,
  openCamp,
  openSeason,
  overall,
  payrollOf,
  placeFaBid,
  profit,
  promote,
  releasePlayer,
  respondInbox,
  retireGm,
  serialize,
  setBlock,
  setFocus,
  setPlan,
  PLANS,
  weekAgenda,
  setLineup,
  setRotation,
  setStaff,
  setTender,
  setTutorialSeen,
  shownOverall,
  simDay,
  simPlayoffDay,
  simRestOfOctober,
  simToOctober,
  simWeek,
  SITUATIONS,
  standings,
  submitTrade,
  takeToasts,
  TEAMS,
  teamLabel,
  teamOf,
  tradePreview,
  userTeamOf,
} from "./career.js";
import { confidenceLabel } from "./roster.js";
import { playerReport, playerRole } from "./report.js";
import { esc, fmtAvg, fmtEra, fmtIp, fmtMoney, fmtPct, fullName } from "./util.js";
import { playClick, playConfirm, playLoss, playTrophy, playWeek, playWin, resumeAudio, syncMusic } from "./audio.js";

const VIEWS = [
  ["desk", "Desk"],
  ["roster", "Roster"],
  ["standings", "Standings"],
  ["scores", "Scores"],
  ["wire", "Wire"],
  ["market", "Market"],
  ["books", "Books"],
  ["leaders", "Leaders"],
  ["october", "October"],
  ["trophies", "Trophies"],
];

const ui = {
  screen: "title",
  view: "desk",
  playerId: null,
  newGame: { name: "Jordan Hale", difficulty: "standard", situation: "standard", teamId: "gulls" },
  trade: { teamId: "ospreys", send: [], recv: [], cashSend: 0, cashRecv: 0 },
  modal: null,
  toasts: [],
  tutorial: 0,
  settings: {
    master: 0.8,
    music: 0.28,
    sfx: 0.7,
    muted: false,
    textScale: 1,
    reduceMotion: false,
    confirmSim: true,
  },
};

let career = null;

function $(sel) { return document.querySelector(sel); }

function loadSettings() {
  try {
    const raw = localStorage.getItem("foc-settings");
    if (raw) ui.settings = { ...ui.settings, ...JSON.parse(raw) };
  } catch { /* keep defaults */ }
}

function saveSettings() {
  localStorage.setItem("foc-settings", JSON.stringify(ui.settings));
  document.documentElement.style.fontSize = `${16 * (ui.settings.textScale || 1)}px`;
  document.body.classList.toggle("reduce-motion", !!ui.settings.reduceMotion);
  syncMusic(ui.settings);
}

function autosave() {
  if (!career) return;
  const text = serialize(career);
  try { localStorage.setItem("foc-autosave", text); } catch { /* quota */ }
  window.foc?.writeAutosave?.(text);
}

function hasAutosave() {
  return !!localStorage.getItem("foc-autosave");
}

function toast(text, kind = "") {
  const id = Math.random().toString(36).slice(2);
  ui.toasts.push({ text, kind, id });
  if (ui.toasts.length > 4) ui.toasts.shift();
  setTimeout(() => {
    const idx = ui.toasts.findIndex((t) => t.id === id);
    if (idx >= 0) ui.toasts.splice(idx, 1);
    document.querySelector(`[data-toast="${id}"]`)?.remove();
  }, 4200);
}

function consumeToasts() {
  if (!career) return;
  for (const item of takeToasts(career)) {
    const name = typeof item === "string" ? item : item?.name;
    const id = typeof item === "string" ? null : item?.id;
    if (!name) continue;
    toast(`Trophy unlocked: ${name}`, "trophy");
    playTrophy();
    if (id) window.foc?.activateAchievement?.(id);
  }
}

function seal(team, size = 52) {
  const [fill, ink] = team.colors;
  const letters = team.name.slice(0, 2).toUpperCase();
  return `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="${fill}"/><circle cx="32" cy="32" r="23" fill="none" stroke="${ink}" stroke-width="2"/><text x="32" y="38" text-anchor="middle" fill="${ink}" font-size="16" font-family="Noto Serif, serif">${letters}</text></svg>`;
}

function phaseLabel(state) {
  if (state.phase === "preseason") return "Camp";
  if (state.phase === "season") return `Week ${state.week + 1} · Game ${state.day + 1} of 4`;
  if (state.phase === "playoffs") return "October";
  if (state.phase === "recap") return "Season review";
  if (state.phase === "tender") return "Arbitration";
  if (state.phase === "free_agency") return `Free agency · week ${state.faWeek + 1} of 4`;
  if (state.phase === "draft") return "The draft";
  if (state.phase === "camp") return "Report to camp";
  if (state.phase === "legacy") return "Legacy";
  return state.phase;
}

function placeLine(state) {
  const team = userTeamOf(state);
  const table = standings(state).find((l) => l.league === team.league);
  const div = table?.divisions.find((d) => d.division === team.division);
  const idx = div ? div.teams.findIndex((row) => row.team.id === team.id) : 0;
  const gb = div?.teams[idx]?.gb || 0;
  const spot = ["1st", "2nd", "3rd", "4th"][idx] || "";
  return `${spot} in the ${team.division}${gb ? ` · ${gb.toFixed(1)} GB` : ""}`;
}

function goalExtra(state, goal) {
  const team = userTeamOf(state);
  if (goal.met) return "Met";
  if (goal.type === "wins") return `${team.wins}/${goal.n}`;
  if (goal.type === "payroll") return fmtMoney(payrollOf(state, team));
  if (goal.type === "profit") return fmtMoney(profit(state));
  if (goal.type === "rookie") {
    const best = Math.max(0, ...roster(state, team).map((p) => p.wasRookie ? Math.max(p.season.bat.g, p.season.pit.g) : 0));
    return `${best}/${goal.n}`;
  }
  return "";
}

function roster(state, team) {
  return [...team.active, ...team.farm].map((id) => state.players[id]).filter(Boolean);
}

function gradeBand(value) {
  if (value >= 75) return "star";
  if (value >= 65) return "plus";
  if (value >= 58) return "above";
  if (value >= 48) return "avg";
  if (value >= 40) return "fringe";
  return "poor";
}

function grade(state, p, key) {
  const g = displayGrade(p, key, state.year, state.userTeamId);
  const band = g.exact ? gradeBand(g.value) : "fog";
  return `<span class="grade ${band}" title="${gradeLabel(g.value)}">${g.value}</span>`;
}

function clubRole(p) {
  if (!p) return "";
  if (p.injuredWeeks) return `Injured ${p.injuredWeeks}w`;
  if (!p.teamId) return "Free agent";
  const team = teamOf(career, p.teamId);
  if (!team) return "";
  if (team.farm.includes(p.id)) return "Farm";
  if (!p.isPitcher) {
    const slot = team.lineup.find((s) => s.id === p.id);
    if (slot) return `Starting ${slot.pos}`;
    return "Bench";
  }
  const spot = team.rotation.indexOf(p.id);
  if (spot === 0) return "Ace";
  if (spot > 0) return `Game ${spot + 1}`;
  return p.role === "RP" ? "Bullpen" : "Starter";
}

function dealLine(p) {
  const years = p.contract?.years || 0;
  const kind = {
    prearb: "club control",
    arb: "arbitration",
    fa: "open-market deal",
    extension: "extension",
  }[p.contract?.type] || p.contract?.type || "no deal";
  return `${fmtMoney(p.contract?.salary || 0)} for ${years} ${years === 1 ? "year" : "years"}, ${kind}.`;
}

function toolsFor(p) {
  return p.isPitcher ? [["STF", "stuff"], ["CTL", "control"], ["MOV", "movement"], ["STM", "stamina"]] : [["CON", "contact"], ["POW", "power"], ["EYE", "eye"], ["SPD", "speed"], ["DEF", "defense"], ["ARM", "arm"]];
}

function after(result, sound = "click") {
  if (sound === "confirm") playConfirm();
  else if (sound === "week") playWeek();
  else if (sound === "win") playWin();
  else if (sound === "loss") playLoss();
  else playClick();
  if (result?.message) toast(result.message);
  consumeToasts();
  notePhase();
  autosave();
  render();
}

function notePhase() {
  if (!career) return;
  if (career.phase === ui.phaseSeen) return;
  const prev = ui.phaseSeen;
  ui.phaseSeen = career.phase;
  if (prev == null) return;
  const view = viewForPhase(career.phase, prev);
  if (view) ui.view = view;
}

function viewForPhase(phase, prev) {
  if (phase === "recap" || phase === "camp" || phase === "legacy") return "desk";
  if (phase === "playoffs") return "october";
  if (phase === "tender" || phase === "free_agency" || phase === "draft") return "market";
  if (phase === "season" && prev === "preseason") return "desk";
  return null;
}

function prepareDraft() {
  if (!career || career.phase !== "draft") return;
  const pick = career.draft?.picks?.find((p) => !p.playerId);
  if (pick && pick.teamId !== career.userTeamId) {
    advanceDraftCpu(career);
    consumeToasts();
    autosave();
  }
}

function shell(body) {
  const team = userTeamOf(career);
  const openDesk = weekAgenda(career).filter((item) => item.tone !== "done").length;
  const nav = VIEWS.map(([id, label]) => `<button type="button" data-act="nav" data-view="${id}" class="${ui.view === id ? "on" : ""}">${label}${id === "desk" && openDesk ? `<span class="badge">${openDesk}</span>` : ""}</button>`).join("");
  const security = career.gm.security;
  return `<div class="shell">
    <header class="topbar">
      <div class="identity">${seal(team)}<div><h2>${esc(team.city)} ${esc(team.name)}</h2><p>${esc(phaseLabel(career))} · ${team.wins}-${team.losses} · ${esc(placeLine(career))}</p></div></div>
      <div class="meters">
        <div class="meter-block"><span>Job security ${Math.round(security)}</span><div class="meter"><i style="width:${security}%"></i></div></div>
        <div class="meter-block"><span>Payroll ${fmtMoney(payrollOf(career, team), 1)}</span><div class="fine">Budget ${fmtMoney(team.budget, 0)} · ${esc(team.owner.name)}</div></div>
        <button type="button" class="btn-ghost" data-act="menu">Office</button>
      </div>
    </header>
    <nav class="nav">${nav}</nav>
    <main class="stage">${body}</main>
    ${actionbar()}
  </div>`;
}

function actionbar() {
  const buttons = [];
  const push = (act, label, primary = false) => buttons.push(`<button type="button" class="${primary ? "btn-primary" : "btn-ghost"}" data-act="${act}">${label}</button>`);
  if (career.phase === "preseason") push("open-season", "Open the season", true);
  if (career.phase === "season") {
    push("sim-day", "Sim day", true);
    push("sim-week", "Sim series");
    push("sim-october", "Sim to October");
  }
  if (career.phase === "playoffs") {
    push("sim-playoff", "Sim game", true);
    push("sim-october-rest", "Sim the rest of October");
  }
  if (career.phase === "recap") push("ack-recap", "Open the winter", true);
  if (career.phase === "tender") push("file-tenders", "File tenders", true);
  if (career.phase === "free_agency") push("advance-fa", "Advance free agency", true);
  if (career.phase === "draft") push("draft-best", "Take the top name on your board", true);
  if (career.phase === "camp") push("open-camp", "Open camp", true);
  const notes = ui.toasts.length
    ? `<div class="bar-notes">${ui.toasts.map((t) => `<div class="toast ${t.kind}">${esc(t.text)}</div>`).join("")}</div>`
    : "";
  return `<footer class="actionbar"><div class="bar-actions">${buttons.join("")}</div><span class="spacer">Front Office Corner ${GAME_VERSION}</span>${notes}</footer>`;
}

function viewDesk() {
  const team = userTeamOf(career);
  const paper = career.paper || { kicker: "The Corner Post", headline: "The desk is clear", deck: "", body: "" };
  const goals = career.goals.map((g) => `<div class="goal${g.met ? " met" : ""}"><span>${esc(g.text)}</span><span class="num">${esc(goalExtra(career, g))}</span></div>`).join("");
  const series = currentSeries(career);
  let next = "The schedule is being printed.";
  if (series) {
    const oppId = series.home === team.id ? series.away : series.home;
    const opp = teamOf(career, oppId);
    const where = series.home === team.id ? "Home" : "Road";
    const done = series.results.filter(Boolean).length;
    next = `<strong>${esc(teamLabel(opp))}</strong><div class="muted">${where} · ${esc(opp.parkName)} · ${done} of 4 played</div>`;
  }
  const inbox = career.inbox.filter((i) => !i.resolved);
  const inboxHtml = inbox.length ? inbox.map(inboxCard).join("") : `<p class="muted">The inbox is clear.</p>`;
  const digest = career.digest?.length > 1 ? `<div class="card"><h3>While the weeks ran</h3>${career.digest.slice(-8).map((d) => `<div class="goal"><span>Week ${d.week}</span><span>${esc(d.text)}</span></div>`).join("")}</div>` : "";
  const focus = (career.focus || []).map((id) => career.players[id]).filter(Boolean);
  const slate = career.staffLocked ? "" : `<section class="card"><h3>Development slate</h3>${focus.length ? focus.map((p) => `<div class="goal"><span>${playerButton(p)}</span><span>${esc(playerRole(p))}</span></div>`).join("") : "<p class=\"muted\">Name two farm players, 25 or under, from the ledger. They get the extra winter reps.</p>"}</section>`;
  const growth = career.growth && (career.growth.rose.length || career.growth.fell.length) ? `<section class="card"><h3>Since last winter</h3>${career.growth.rose.map((row) => `<div class="goal"><span>${esc(row.name)}</span><span class="good">${row.from} to ${row.to}</span></div>`).join("")}${career.growth.fell.map((row) => `<div class="goal"><span>${esc(row.name)}</span><span class="bad">${row.from} to ${row.to}</span></div>`).join("")}</section>` : "";
  const agenda = weekAgenda(career).map((item) => {
    const cls = `agenda ${item.tone}`;
    if (!item.view || item.view === ui.view) return `<div class="${cls}"><span>${esc(item.text)}</span></div>`;
    return `<button type="button" class="${cls}" data-act="nav" data-view="${item.view}"><span>${esc(item.text)}</span></button>`;
  }).join("");
  const plan = planCard();
  return `<div class="desk">
    <article class="paper">
      <div class="mast"><strong>${esc(paper.kicker || "The Corner Post")}</strong><span>${career.year}</span></div>
      <h3>${esc(paper.headline || "")}</h3>
      <p class="deck">${esc(paper.deck || "")}</p>
      <p>${esc(paper.body || "")}</p>
    </article>
    <div class="stack">
      <section class="card"><h3>This week</h3>${agenda}</section>
      ${plan}
      <section class="card"><h3>This series</h3>${next}</section>
      <section class="card"><h3>Inbox</h3>${inboxHtml}</section>
      ${slate}
      ${growth}
      <section class="card"><h3>Owner's goals</h3>${goals}<p class="muted">${esc(team.owner.name)}, ${esc(team.owner.style.replace("-", " "))}. ${esc(team.blurb)}</p></section>
      ${digest}
    </div>
  </div>`;
}

function planCard() {
  if (career.phase !== "season") return "";
  const locked = career.day > 0;
  const current = career.plan && career.plan.week === career.week ? career.plan.focus : "";
  const named = PLANS.find((plan) => plan.id === current);
  const buttons = PLANS.map((plan) => `<button type="button" class="choice ${current === plan.id ? "on" : ""}" data-act="plan" data-id="${plan.id}" ${locked ? "disabled" : ""}><strong>${esc(plan.title)}</strong><span>${esc(plan.text)}</span></button>`).join("");
  const note = named
    ? (locked ? `${named.title} is locked until the next series.` : `This series: ${named.title}.`)
    : (locked ? "No plan this series. The next one is still open." : "It lasts four games, then you name another.");
  return `<section class="card"><h3>Series plan</h3><div class="plan-grid">${buttons}</div><p class="muted">${esc(note)}</p></section>`;
}

function inboxCard(item) {
  const buttons = [];
  if (item.kind === "trade") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="accept">Accept</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="decline">Decline</button>`);
  else if (item.kind === "callup") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="accept">Call him up</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="decline">Leave him down</button>`);
  else if (item.kind === "playing") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="accept">Start him</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="decline">Sit him</button>`);
  else if (item.kind === "claim") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="accept">Claim</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="decline">Pass</button>`);
  else if (item.kind === "camp") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="a">${esc(career.players[item.aId]?.last || "A")}</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="b">${esc(career.players[item.bId]?.last || "B")}</button>`);
  else if (item.kind === "owner") buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="accept">Do it</button><button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="decline">Refuse</button>`);
  else buttons.push(`<button type="button" class="btn-small" data-act="inbox" data-id="${item.id}" data-choice="file">File</button>`);
  return `<div class="inbox-item"><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p><div class="row-actions">${buttons.join("")}</div></div>`;
}

function playerButton(p) {
  return `<button type="button" class="linkish" data-act="player" data-id="${p.id}">${esc(fullName(p))}</button>`;
}

function viewRoster() {
  if (ui.playerId && career.players[ui.playerId]) return viewPlayer(career.players[ui.playerId]);
  const team = userTeamOf(career);
  const rows = (ids, farm) => ids.map((id) => career.players[id]).filter(Boolean).map((p) => {
    const bat = p.season.bat;
    const pit = p.season.pit;
    const ovr = shownOverall(career, p);
    const line = p.isPitcher ? `${pit.w}-${pit.l}, ${fmtEra(pit.er, pit.outs)}` : `${fmtAvg(bat.h, bat.ab)} · ${bat.hr} HR`;
    return `<tr>
      <td>${esc(p.pos)}</td>
      <td>${playerButton(p)}${p.injuredWeeks ? ` <span class="bad">IL ${p.injuredWeeks}w</span>` : ""}${p.onBlock ? ` <span class="muted">block</span>` : ""}${(career.focus || []).includes(p.id) ? ` <span class="good">slate</span>` : ""}</td>
      <td class="r num">${p.age}</td>
      <td class="r"><span class="grade ${gradeBand(ovr)}">${ovr}</span></td>
      <td class="tools">${toolsFor(p).map(([, key]) => grade(career, p, key)).join(" ")}</td>
      <td class="r num">${line}</td>
      <td class="r num">${fmtMoney(p.contract?.salary || 0)} / ${p.contract?.years || 0}y</td>
      <td>${farm ? "Farm" : "Active"}</td>
    </tr>`;
  }).join("");
  const lineup = team.lineup.map((slot, i) => {
    const options = team.active.map((id) => career.players[id]).filter((p) => p && !p.isPitcher).map((p) => `<option value="${p.id}" ${p.id === slot.id ? "selected" : ""} ${p.injuredWeeks ? "disabled" : ""}>${esc(p.last)} · ${p.pos}</option>`).join("");
    return `<div class="goal"><span>${i + 1}. ${esc(slot.pos)}</span><select data-act="lineup" data-index="${i}">${options}</select></div>`;
  }).join("");
  const arms = team.active.map((id) => career.players[id]).filter((p) => p && p.isPitcher);
  const rotation = team.rotation.map((id, i) => {
    const options = arms.map((p) => `<option value="${p.id}" ${p.id === id ? "selected" : ""} ${p.injuredWeeks ? "disabled" : ""}>${esc(p.last)} · ${p.role}</option>`).join("");
    return `<div class="goal"><span>Game ${i + 1}</span><select data-act="rotation" data-index="${i}">${options}</select></div>`;
  }).join("");
  return `<div class="roster-layout">
    <section>
      <h3 class="section-title">Ledger</h3>
      <table class="grid"><thead><tr><th>Pos</th><th>Player</th><th class="r">Age</th><th class="r">OVR</th><th>Tools</th><th class="r">Season</th><th class="r">Deal</th><th></th></tr></thead><tbody>
      ${rows(team.active, false)}
      ${rows(team.farm, true)}
      </tbody></table>
    </section>
    <section class="stack">
      <div class="card"><h3>Lineup card</h3>${lineup}<button type="button" class="btn-small" data-act="auto-lineup">Let the staff set it</button></div>
      <div class="card"><h3>Rotation</h3>${rotation}<button type="button" class="btn-small" data-act="auto-rotation">Sort the arms</button></div>
    </section>
  </div>`;
}

function viewPlayer(p) {
  const team = userTeamOf(career);
  const own = p.teamId === team.id;
  const noise = own ? 0 : (p.scoutNoise || 0);
  const pills = toolsFor(p).map(([label, key]) => {
    const g = displayGrade(p, key, career.year, career.userTeamId);
    const band = g.exact ? gradeBand(g.value) : "fog";
    return `<span class="pill ${band}"><small>${label}</small><b>${g.value}</b><small>${gradeLabel(g.value)}</small></span>`;
  }).join("");
  const b = p.season.bat;
  const c = p.career.bat;
  const pit = p.season.pit;
  const cp = p.career.pit;
  const batting = `<table class="grid"><thead><tr><th></th><th class="r">AVG</th><th class="r">HR</th><th class="r">RBI</th><th class="r">R</th><th class="r">SB</th><th class="r">BB</th><th class="r">K</th></tr></thead><tbody>
    <tr><td>Season</td><td class="r num">${fmtAvg(b.h, b.ab)}</td><td class="r num">${b.hr}</td><td class="r num">${b.rbi}</td><td class="r num">${b.r}</td><td class="r num">${b.sb}</td><td class="r num">${b.bb}</td><td class="r num">${b.k}</td></tr>
    <tr><td>Career</td><td class="r num">${fmtAvg(c.h, c.ab)}</td><td class="r num">${c.hr}</td><td class="r num">${c.rbi}</td><td class="r num">${c.r}</td><td class="r num">${c.sb}</td><td class="r num">${c.bb}</td><td class="r num">${c.k}</td></tr>
  </tbody></table>`;
  const pitching = `<table class="grid"><thead><tr><th></th><th class="r">W-L</th><th class="r">ERA</th><th class="r">IP</th><th class="r">K</th><th class="r">BB</th><th class="r">SV</th></tr></thead><tbody>
    <tr><td>Season</td><td class="r num">${pit.w}-${pit.l}</td><td class="r num">${fmtEra(pit.er, pit.outs)}</td><td class="r num">${fmtIp(pit.outs)}</td><td class="r num">${pit.k}</td><td class="r num">${pit.bb}</td><td class="r num">${pit.sv}</td></tr>
    <tr><td>Career</td><td class="r num">${cp.w}-${cp.l}</td><td class="r num">${fmtEra(cp.er, cp.outs)}</td><td class="r num">${fmtIp(cp.outs)}</td><td class="r num">${cp.k}</td><td class="r num">${cp.bb}</td><td class="r num">${cp.sv}</td></tr>
  </tbody></table>`;
  const ask = marketSalary(p);
  const onSlate = (career.focus || []).includes(p.id);
  const canFocus = own && !career.staffLocked && team.farm.includes(p.id) && p.age <= 25;
  const focusButton = canFocus ? `<button type="button" class="btn-small" data-act="focus" data-id="${p.id}">${onSlate ? "Take off the slate" : "Put on the development slate"}</button>` : "";
  const actions = own ? `<div class="card"><h3>Desk</h3>
      <p>Market ask about ${fmtMoney(ask)}. Service ${p.service}. ${esc(p.personality.charAt(0).toUpperCase() + p.personality.slice(1))}.</p>
      <div class="row-actions">
        ${focusButton}
        <button type="button" class="btn-small" data-act="block" data-id="${p.id}">${p.onBlock ? "Pull off the block" : "Put on the block"}</button>
        ${team.farm.includes(p.id) ? `<button type="button" class="btn-small" data-act="promote" data-id="${p.id}">Call up</button>` : `<button type="button" class="btn-small" data-act="demote" data-id="${p.id}">Send down</button>`}
        <button type="button" class="btn-danger btn-small" data-act="release-ask" data-id="${p.id}">Release</button>
      </div>
      <form class="row-actions" data-act="extend" data-id="${p.id}" style="margin-top:10px">
        <input class="tiny" name="years" type="number" min="2" max="6" value="4" />
        <input class="tiny" name="salary" type="number" min="0.74" step="0.1" value="${ask}" />
        <button type="submit" class="btn-small">Offer extension</button>
      </form>
    </div>` : `<div class="card"><p class="muted">Scouting confidence: ${confidenceLabel(noise)}. ${noise < 1.5 ? "The report is complete." : "Grades are estimates."}</p></div>`;
  const ovr = shownOverall(career, p);
  const exact = own || (p.scoutNoise ?? 10) < 1.5;
  const pot = displayGrade(p, "potential", career.year, career.userTeamId);
  return `<div class="dossier">
    <section>
      <button type="button" class="btn-small" data-act="nav" data-view="roster">Back to the ledger</button>
      <h3 class="section-title">${esc(fullName(p))}</h3>
      <p class="muted">${esc(p.pos)} · ${esc(playerRole(p))} · ${esc(clubRole(p))} · ${p.bats}/${p.throws} · Age ${p.age} · OVR <span class="grade ${exact ? gradeBand(ovr) : "fog"}">${ovr}</span> · POT <span class="grade ${pot.exact ? gradeBand(pot.value) : "fog"}">${pot.value}</span></p>
      <div class="grades">${pills}</div>
      ${p.isPitcher ? pitching : batting}
      ${!p.isPitcher && p.season.pit.outs ? pitching : ""}
    </section>
    <section class="stack">
      <div class="card"><h3>Scouting report</h3><p class="report">${esc(playerReport(p, noise))}</p></div>
      <div class="card"><h3>Contract</h3><p>${dealLine(p)}</p><p class="muted">Morale ${p.morale}. Durability ${p.durability}.</p></div>
      ${actions}
    </section>
  </div>`;
}

function viewStandings() {
  return standings(career).map((league) => `<section><h3 class="section-title">${esc(league.league)} League</h3>${league.divisions.map((div) => `<h4>${esc(div.division)}</h4><table class="grid"><thead><tr><th>Club</th><th class="r">W</th><th class="r">L</th><th class="r">PCT</th><th class="r">GB</th><th class="r">RS</th><th class="r">RA</th></tr></thead><tbody>${div.teams.map(({ team, gb }) => `<tr class="${team.id === career.userTeamId ? "good" : ""}"><td>${esc(team.city)} ${esc(team.name)}</td><td class="r num">${team.wins}</td><td class="r num">${team.losses}</td><td class="r num">${fmtPct(team.wins, team.losses)}</td><td class="r num">${gb ? gb.toFixed(1) : "—"}</td><td class="r num">${team.rs}</td><td class="r num">${team.ra}</td></tr>`).join("")}</tbody></table>`).join("")}</section>`).join("");
}

function linescore(box) {
  const n = Math.max(box.homeInnings.length, box.awayInnings.length, 9);
  const head = Array.from({ length: n }, (_, i) => `<th class="r">${i + 1}</th>`).join("");
  const row = (id, inns, runs, hits, err) => {
    const team = teamOf(career, id);
    const cells = Array.from({ length: n }, (_, i) => `<td class="r num">${inns[i] ?? ""}</td>`).join("");
    return `<tr><td>${esc(team.name)}</td>${cells}<td class="r num"><b>${runs}</b></td><td class="r num">${hits}</td><td class="r num">${err}</td></tr>`;
  };
  const notes = (box.notes || []).slice(0, 8).map((n) => `<li>${esc(n)}</li>`).join("");
  const arm = (id) => (id && career.players[id] ? esc(fullName(career.players[id])) : "");
  const decisions = [box.wp ? `W ${arm(box.wp)}` : "", box.lp ? `L ${arm(box.lp)}` : "", box.sv ? `S ${arm(box.sv)}` : ""].filter(Boolean).join(" · ");
  return `<div class="linescore"><table class="grid"><thead><tr><th></th>${head}<th class="r">R</th><th class="r">H</th><th class="r">E</th></tr></thead><tbody>${row(box.awayId, box.awayInnings, box.awayRuns, box.awayHits, box.awayErrors)}${row(box.homeId, box.homeInnings, box.homeRuns, box.homeHits, box.homeErrors)}</tbody></table>${decisions ? `<p class="muted">${decisions}</p>` : ""}${notes ? `<ul>${notes}</ul>` : ""}</div>`;
}

function viewScores() {
  const series = currentSeries(career);
  let yours = "<p class='muted'>No series on the card.</p>";
  if (series) {
    const played = series.results.filter(Boolean);
    yours = played.length ? played.map(linescore).join("<hr>") : "<p class='muted'>The series has not started.</p>";
  }
  const week = career.schedule?.[Math.min(career.week, (career.schedule?.length || 1) - 1)] || [];
  const day = Math.max(0, career.day - 1);
  const board = week.map((g) => {
    const box = g.results[day] || g.results.filter(Boolean).at(-1);
    if (!box) return "";
    const home = teamOf(career, box.homeId);
    const away = teamOf(career, box.awayId);
    return `<div class="series"><span>${esc(away.name)} ${box.awayRuns}</span><span>${esc(home.name)} ${box.homeRuns}</span></div>`;
  }).join("");
  return `<div class="split"><section class="card"><h3>Your series</h3>${yours}</section><section class="card"><h3>Around the league</h3>${board || "<p class='muted'>No scores yet.</p>"}</section></div>`;
}

function viewWire() {
  const items = career.news.slice(0, 40).map((n) => `<article class="inbox-item"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><span class="muted">${n.year} · week ${n.week + 1}</span></article>`).join("");
  return `<section class="panel"><h3>The wire</h3>${items || "<p class='muted'>Nothing has happened yet.</p>"}</section>`;
}

function viewMarket() {
  if (career.phase === "tender") return viewTenders();
  if (career.phase === "free_agency") return viewFreeAgency();
  if (career.phase === "draft" || career.phase === "camp") return viewDraft();
  return viewTrade();
}

function viewTrade() {
  const team = userTeamOf(career);
  const them = teamOf(career, ui.trade.teamId) || career.teams.find((t) => t.id !== team.id);
  ui.trade.teamId = them.id;
  const options = career.teams.filter((t) => t.id !== team.id).map((t) => `<option value="${t.id}" ${t.id === them.id ? "selected" : ""}>${esc(t.city)} ${esc(t.name)}</option>`).join("");
  const list = (ids, side) => ids.map((id) => career.players[id]).filter(Boolean).map((p) => {
    const on = (side === "send" ? ui.trade.send : ui.trade.recv).includes(p.id);
    return `<button type="button" class="btn-small" data-act="trade-toggle" data-side="${side}" data-id="${p.id}">${on ? "✓ " : ""}${esc(p.last)} · ${esc(p.pos)} · ${shownOverall(career, p)}</button>`;
  }).join(" ");
  const preview = tradePreview(career, them.id, ui.trade.send, ui.trade.recv, ui.trade.cashSend, ui.trade.cashRecv);
  const closed = career.phase === "season" && career.week >= 10;
  return `<section class="panel"><h3>Trade wire ${closed ? "· deadline passed" : ""}</h3>
    <label class="field">Club<select data-act="trade-team">${options}</select></label>
    <div class="split" style="margin-top:12px">
      <div><h4>Yours</h4><div class="row-actions">${list(team.active, "send")}</div></div>
      <div><h4>Theirs</h4><div class="row-actions">${list(them.active, "recv")}</div></div>
    </div>
    <div class="row-actions" style="margin-top:12px">
      <label class="field">Cash you send<input class="tiny" data-act="cash-send" type="number" min="0" max="12" step="0.5" value="${ui.trade.cashSend}"></label>
      <label class="field">Cash you receive<input class="tiny" data-act="cash-recv" type="number" min="0" max="12" step="0.5" value="${ui.trade.cashRecv}"></label>
      <button type="button" class="btn-primary" data-act="trade-submit" ${closed ? "disabled" : ""}>Propose</button>
    </div>
    <p>${esc(preview.lean || preview.message || "")}. Desk change for you: ${Number.isFinite(preview.userGain) ? preview.userGain.toFixed(1) : "—"}. ${career.staff.analytics >= 6 ? "Analytics is confident." : "Fund analytics if you want a cleaner read."}</p>
  </section>`;
}

function viewFreeAgency() {
  const team = userTeamOf(career);
  const room = team.budget - payrollOf(career, team);
  const rows = career.freeAgents.map((id) => career.players[id]).filter(Boolean).sort((a, b) => (b.demand || 0) - (a.demand || 0)).slice(0, 40).map((p) => `<tr>
    <td>${playerButton(p)}</td><td>${esc(p.pos)}</td><td class="r num">${p.age}</td><td class="r num">${shownOverall(career, p)}</td>
    <td class="r num">${fmtMoney(p.demand || 0)} / ${p.demandYears || 1}y</td>
    <td><input class="tiny" id="y-${p.id}" type="number" min="1" max="6" value="${p.demandYears || 2}"></td>
    <td><input class="tiny" id="s-${p.id}" type="number" min="0.74" step="0.1" value="${p.demand || 1}"></td>
    <td><button type="button" class="btn-small" data-act="bid" data-id="${p.id}">Bid</button></td>
  </tr>`).join("");
  return `<section><h3 class="section-title">Open market</h3><p class="muted">Room against the budget: ${fmtMoney(room)}. Offers resolve when you advance the week. ${career.freeAgents.length} players are unsigned.</p>
    <table class="grid"><thead><tr><th>Player</th><th>Pos</th><th class="r">Age</th><th class="r">OVR</th><th class="r">Ask</th><th>Years</th><th>AAV</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function viewTenders() {
  const entries = Object.entries(career.tenders || {});
  if (!entries.length) return `<section class="panel"><h3>Arbitration</h3><p>No tenders are due. File the papers to open free agency.</p></section>`;
  const rows = entries.map(([id, row]) => {
    const p = career.players[id];
    if (!p) return "";
    return `<tr><td>${playerButton(p)}</td><td>${esc(p.pos)}</td><td class="r num">${fmtMoney(row.ask)}</td><td>${row.tender ? "Tender" : "Non-tender"}</td><td><button type="button" class="btn-small" data-act="tender" data-id="${id}" data-yes="1">Tender</button> <button type="button" class="btn-small" data-act="tender" data-id="${id}" data-yes="0">Walk</button></td></tr>`;
  }).join("");
  return `<section><h3 class="section-title">Tender or walk</h3><table class="grid"><thead><tr><th>Player</th><th>Pos</th><th class="r">Ask</th><th>Call</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function viewDraft() {
  const pick = career.draft?.picks?.find((p) => !p.playerId);
  const yours = pick && pick.teamId === career.userTeamId;
  const recent = (career.draft?.picks || []).filter((p) => p.playerId).slice(-8).map((p) => {
    const pl = career.players[p.playerId];
    const club = teamOf(career, p.teamId);
    return `<div class="goal"><span>${p.overall}. ${esc(club?.name || "")}</span><span>${esc(pl ? fullName(pl) : "")}</span></div>`;
  }).join("");
  const board = (career.draft?.pool || []).slice().sort((a, b) => prospectGrade(b) - prospectGrade(a)).slice(0, 40).map((id) => {
    const p = career.players[id];
    const pot = displayGrade(p, "potential", career.year, career.userTeamId);
    return `<tr><td>${esc(p.pos)}</td><td>${esc(fullName(p))}</td><td class="r num">${p.age}</td><td class="r num">${pot.value}${pot.exact ? "" : "?"}</td><td class="r num">${shownOverall(career, p)}</td><td>${yours ? `<button type="button" class="btn-small" data-act="draft" data-id="${p.id}">Draft</button>` : ""}</td></tr>`;
  }).join("");
  const headline = !career.draft ? "The board is packed away." : yours ? `You are on the clock. Round ${pick.round}, pick ${pick.overall}${pick.supplemental ? " (supplemental)" : ""}.` : pick ? `${esc(teamLabel(teamOf(career, pick.teamId)))} is choosing.` : "The draft is complete.";
  return `<section><h3 class="section-title">Draft room</h3><p>${headline}</p><div class="split"><div><table class="grid"><thead><tr><th>Pos</th><th>Name</th><th class="r">Age</th><th class="r">POT</th><th class="r">NOW</th><th></th></tr></thead><tbody>${board}</tbody></table></div><div class="card"><h3>Recent picks</h3>${recent || "<p class='muted'>No picks yet.</p>"}</div></div></section>`;
}

function prospectGrade(id) {
  const p = career.players[id];
  return displayGrade(p, "potential", career.year, career.userTeamId).value;
}

function viewBooks() {
  const team = userTeamOf(career);
  const b = career.books;
  const bar = (label, value, max, color) => `<div class="bar"><span>${label}</span><span class="track"><i style="width:${Math.max(value ? 2 : 0, Math.min(100, (Math.abs(value) / max) * 100))}%;background:${color}"></i></span><span class="num">${fmtMoney(value)}</span></div>`;
  const max = Math.max(1, b.tickets, b.media, b.payroll, b.staff, b.dead, b.tax);
  const locked = career.phase !== "preseason" || career.staffLocked;
  const slider = (key, label) => `<label class="field">${label} · ${career.staff[key].toFixed(1)}<input type="range" min="0" max="12" step="0.5" value="${career.staff[key]}" data-act="staff" data-key="${key}" ${locked ? "disabled" : ""}></label>`;
  const att = team.homeGames ? Math.round(team.attendanceTotal / team.homeGames) : 0;
  const ranks = career.teams.map((t) => ({ id: t.id, pay: payrollOf(career, t) })).sort((a, b) => b.pay - a.pay);
  const rank = ranks.findIndex((r) => r.id === team.id) + 1;
  return `<div class="split">
    <section class="card"><h3>The books</h3>
      <div class="bars">
        ${bar("Tickets", b.tickets, max, "#e4c48a")}
        ${bar("Media", b.media, max, "#8fd0a8")}
        ${bar("Payroll", b.payroll, max, "#e39284")}
        ${bar("Staff", b.staff, max, "#c47b3b")}
        ${bar("Dead money", b.dead, max, "#a3562a")}
        ${bar("Luxury tax", b.tax, max, "#7e2e2e")}
      </div>
      <p>Profit <strong class="${profit(career) >= 0 ? "good" : "bad"}">${fmtMoney(profit(career))}</strong> · Payroll rank ${rank} of 24 · Avg crowd ${att.toLocaleString("en-US")}</p>
      <p class="muted">Luxury tax starts at $165M. ${esc(team.parkName)} plays ${team.park > 1 ? "a little lively" : "a little big"}.</p>
    </section>
    <section class="card"><h3>Staff plan</h3>
      ${slider("scouting", "Scouting")}
      ${slider("development", "Development")}
      ${slider("marketing", "Marketing")}
      ${slider("analytics", "Analytics")}
      <p class="muted">${locked ? "Locked until next camp." : "These lock on Opening Day."} Annual staff cost ${fmtMoney(career.staff.scouting + career.staff.development + career.staff.marketing + career.staff.analytics)}.</p>
    </section>
  </div>`;
}

function viewLeaders() {
  const board = leaders(career);
  const bat = (list, cell) => list.map((p) => `<tr><td>${playerButton(p)}</td><td>${esc(teamOf(career, p.teamId)?.name || "FA")}</td><td class="r num">${cell(p)}</td></tr>`).join("");
  const block = (title, rows) => `<div class="card"><h3>${title}</h3><table class="grid"><tbody>${rows || ""}</tbody></table></div>`;
  return `<div class="team-grid">
    ${block("Average", bat(board.avg, (p) => fmtAvg(p.season.bat.h, p.season.bat.ab)))}
    ${block("Home runs", bat(board.hr, (p) => p.season.bat.hr))}
    ${block("RBI", bat(board.rbi, (p) => p.season.bat.rbi))}
    ${block("ERA", bat(board.era, (p) => fmtEra(p.season.pit.er, p.season.pit.outs)))}
    ${block("Strikeouts", bat(board.k, (p) => p.season.pit.k))}
    ${block("Value", bat(board.war, (p) => (p.isPitcher ? p.season.pit.w + " W" : p.season.bat.hr + " HR")))}
  </div>`;
}

function seriesBlock(title, series) {
  if (!series) return "";
  const name = (id) => esc(teamOf(career, id)?.name || "");
  const score = `${name(series.high)} ${series.wins[series.high] || 0} — ${name(series.low)} ${series.wins[series.low] || 0}`;
  const winner = series.winner ? ` · ${name(series.winner)} win` : "";
  return `<div class="card"><h3>${esc(title)}</h3><p>${score}${winner}</p></div>`;
}

function viewOctober() {
  const po = career.playoffs;
  if (!po) return `<section class="panel"><h3>October</h3><p class="muted">The bracket is not set.</p></section>`;
  const blocks = ["Harbor", "Summit"].map((name) => {
    const league = po.leagues[name];
    return `<section><h3 class="section-title">${name}</h3><div class="bracket">${seriesBlock("Series", league.ds[0])}${seriesBlock("Series", league.ds[1])}${seriesBlock("League final", league.final)}</div></section>`;
  }).join("");
  return `${blocks}<section><h3 class="section-title">Continental Series</h3>${seriesBlock("For the chair and the cup", po.continental) || "<p class='muted'>Waiting on the league finals.</p>"}<p>Your October: ${esc(po.userFinish || "undecided")}.</p></section>`;
}

function viewTrophies() {
  const rows = ACHIEVEMENTS.map((a) => {
    const got = career.achievements[a.id];
    const hidden = a.hidden && !got;
    return `<div class="goal"><span>${hidden ? "A quiet trophy" : esc(a.name)}</span><span class="${got ? "good" : "muted"}">${got ? `${got.year}` : hidden ? "Hidden" : esc(a.desc)}</span></div>`;
  }).join("");
  const champs = career.champions.map((c) => `<div class="goal"><span>${c.year}</span><span>${esc(teamLabel(teamOf(career, c.teamId)))}</span></div>`).join("");
  const awards = (career.awardsLog || []).slice().reverse().map((row) => {
    const a = row.awards || {};
    return `<div class="goal"><span>${row.year}</span><span>MVP ${esc(a.mvp?.name || "—")} · Pitching ${esc(a.cy?.name || "—")} · Rookie ${esc(a.roy?.name || "—")}</span></div>`;
  }).join("");
  return `<div class="split"><section class="card"><h3>Trophy case</h3>${rows}</section><section class="stack"><div class="card"><h3>Continental champions</h3>${champs || "<p class='muted'>No banners yet.</p>"}<h3>Your seasons</h3>${career.seasons.map((s) => `<div class="goal"><span>${s.year} ${s.w}-${s.l}</span><span>${esc(s.finish)} · ${fmtMoney(s.profit)}</span></div>`).join("") || "<p class='muted'>The log is empty.</p>"}</div><div class="card"><h3>Award history</h3>${awards || "<p class='muted'>The record book opens after the first year.</p>"}</div></section></div>`;
}

function viewRecap() {
  const a = career.awards || {};
  const line = (label, row) => `<div class="goal"><span>${label}</span><span>${row ? esc(row.name) + " · " + esc(row.line || "") : "—"}</span></div>`;
  const goals = career.goals.map((g) => `<div class="goal${g.met ? " met" : ""}"><span>${esc(g.text)}</span><span>${g.met ? "Met" : "Missed"}</span></div>`).join("");
  return `<section class="panel"><h3>Season review · ${career.year}</h3>
    <p>${userTeamOf(career).wins}-${userTeamOf(career).losses}. Profit ${fmtMoney(profit(career))}. Security ${Math.round(career.gm.security)}.</p>
    ${line("MVP", a.mvp)}${line("Pitching", a.cy)}${line("Rookie", a.roy)}${line("Reliever", a.reliever)}${line("Defense", a.glove)}
    <h3>Goals</h3>${goals}
  </section>`;
}

function stage() {
  if (career.phase === "legacy") return viewLegacy(true);
  if (ui.view === "desk" && career.phase === "recap") return viewRecap();
  if (ui.view === "desk") return viewDesk();
  if (ui.view === "roster") return viewRoster();
  if (ui.view === "standings") return viewStandings();
  if (ui.view === "scores") return viewScores();
  if (ui.view === "wire") return viewWire();
  if (ui.view === "market") return viewMarket();
  if (ui.view === "books") return viewBooks();
  if (ui.view === "leaders") return viewLeaders();
  if (ui.view === "october") return viewOctober();
  if (ui.view === "trophies") return viewTrophies();
  return viewDesk();
}

function viewLegacy(embedded = false) {
  const rows = career.seasons.map((s) => `<div class="goal"><span>${s.year}</span><span>${s.w}-${s.l} · ${esc(s.finish)} · ${fmtMoney(s.profit)}</span></div>`).join("");
  const count = Object.keys(career.achievements).length;
  const inner = `<section class="panel"><h3>${career.gm.fired ? "Dismissed" : "Retired"}</h3><p>${esc(career.letter || career.flash || "")}</p><p>${esc(career.gm.name)} · ${career.meta.titles} titles · ${career.meta.seasons} seasons · ${count} trophies.</p>${rows}<div class="row-actions"><button type="button" class="btn-primary" data-act="title">Back to the door</button></div></section>`;
  if (embedded) return `<div class="wizard">${inner}</div>`;
  return inner;
}

function viewTitle() {
  return `<div class="title-screen">
    <div class="brand">
      <div class="kicker">Continental Diamond League</div>
      <h1>Front Office<span>Corner</span></h1>
      <p class="tagline">Run the club. Keep the job. Win October.</p>
      <p class="version">Edition ${GAME_VERSION} · Original league, original clubs, no real teams.</p>
    </div>
    <div class="menu">
      <button type="button" class="btn-primary" data-act="goto-new">New career</button>
      <button type="button" class="btn" data-act="continue" ${hasAutosave() ? "" : "disabled"}>Continue</button>
      <button type="button" class="btn" data-act="goto-load">Load a file</button>
      <button type="button" class="btn-ghost" data-act="goto-manual">Manual</button>
      <button type="button" class="btn-ghost" data-act="goto-settings">Settings</button>
      <button type="button" class="btn-ghost" data-act="goto-credits">Credits</button>
    </div>
  </div>`;
}

function viewNew() {
  const diffs = DIFFICULTIES.map((d) => `<button type="button" class="choice ${ui.newGame.difficulty === d.id ? "on" : ""}" data-act="pick-diff" data-id="${d.id}"><strong>${esc(d.title)}</strong><span>${esc(d.text)}</span></button>`).join("");
  const sits = SITUATIONS.map((d) => `<button type="button" class="choice ${ui.newGame.situation === d.id ? "on" : ""}" data-act="pick-sit" data-id="${d.id}"><strong>${esc(d.title)}</strong><span>${esc(d.text)}</span></button>`).join("");
  const teams = TEAMS.map((t) => `<button type="button" class="team-card ${ui.newGame.teamId === t.id ? "on" : ""}" data-act="pick-team" data-id="${t.id}">${seal(t, 42)}<span><strong>${esc(t.city)} ${esc(t.name)}</strong><span>${esc(t.league)} ${esc(t.division)} · ${fmtMoney(t.budget, 0)} · ${esc(t.owner.style)}</span><span>${esc(t.outlook)}</span></span></button>`).join("");
  return `<div class="wizard">
    <div class="kicker">New career</div>
    <h1>Take the chair</h1>
    <label class="field">Your name<input id="gm-name" type="text" maxlength="28" value="${esc(ui.newGame.name)}"></label>
    <h3 class="section-title">Difficulty</h3><div class="choices">${diffs}</div>
    <h3 class="section-title">The inheritance</h3><div class="choices">${sits}</div>
    <h3 class="section-title">The club</h3><div class="team-grid">${teams}</div>
    <div class="row-actions"><button type="button" class="btn-primary" data-act="begin">Start the career</button><button type="button" class="btn-ghost" data-act="title">Back</button></div>
  </div>`;
}

function viewManual() {
  markIfCareer();
  const chapters = MANUAL.map((c) => `<article class="manual-chapter"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></article>`).join("");
  return `<div class="wizard"><div class="kicker">Front office manual</div><h1>How the league works</h1>${chapters}<button type="button" class="btn-ghost" data-act="back-manual">Close</button></div>`;
}

function markIfCareer() {
  if (career && !career.meta.readManual) {
    markManualRead(career);
    consumeToasts();
    autosave();
  }
}

function viewSettings() {
  const s = ui.settings;
  const slider = (key, label, min, max, step) => `<label class="field">${label}<input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-act="setting" data-key="${key}"></label>`;
  return `<div class="wizard"><h1>Settings</h1>
    ${slider("master", "Master", 0, 1, 0.05)}
    ${slider("music", "Music", 0, 1, 0.05)}
    ${slider("sfx", "Effects", 0, 1, 0.05)}
    ${slider("textScale", "Text size", 0.9, 1.25, 0.05)}
    <label class="field"><span><input type="checkbox" data-act="check" data-key="muted" ${s.muted ? "checked" : ""}> Mute</span></label>
    <label class="field"><span><input type="checkbox" data-act="check" data-key="reduceMotion" ${s.reduceMotion ? "checked" : ""}> Reduce motion</span></label>
    <label class="field"><span><input type="checkbox" data-act="check" data-key="confirmSim" ${s.confirmSim ? "checked" : ""}> Confirm before simming to October</span></label>
    <button type="button" class="btn-ghost" data-act="back-manual">Close</button>
  </div>`;
}

function viewCredits() {
  return `<div class="wizard"><h1>Credits</h1>
    <p>Front Office Corner is an original career sim. The Continental Diamond League, its cities, and its clubs are fictional. It is not affiliated with any real league, team, or player.</p>
    <p>Type is Noto Sans, Noto Serif, and JetBrains Mono, bundled under their own licenses in assets/fonts.</p>
    <p>The score is generated in the game. There are no licensed recordings.</p>
    <p>Edition ${GAME_VERSION}. Saves stay on this machine unless you export them.</p>
    <button type="button" class="btn-ghost" data-act="back-manual">Close</button>
  </div>`;
}

function modalHtml() {
  if (!ui.modal) return "";
  if (ui.modal.kind === "menu") {
    return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h3>Office</h3><p>The career saves on this machine as you play. Export a file if you want a copy.</p><div class="menu"><button type="button" class="btn" data-act="export">Export save</button><button type="button" class="btn-ghost" data-act="goto-manual">Manual</button><button type="button" class="btn-ghost" data-act="goto-settings">Settings</button><button type="button" class="btn-ghost" data-act="retire-ask">Retire</button><button type="button" class="btn-ghost" data-act="title">Exit to title</button><button type="button" class="btn-primary" data-act="modal-no">Close</button></div></div></div>`;
  }
  return `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h3>${esc(ui.modal.title)}</h3><p>${esc(ui.modal.body)}</p><div class="row-actions"><button type="button" class="btn-primary" data-act="modal-yes">${esc(ui.modal.yes || "Confirm")}</button><button type="button" class="btn-ghost" data-act="modal-no">Cancel</button></div></div></div>`;
}

function tutorialHtml() {
  if (!career || career.seenTutorial || ui.screen !== "game" || ui.modal) return "";
  const steps = [
    "This is the corner office. The paper, the goals, and the owner's patience all live on this desk.",
    "Sim a day or a series from the bar along the bottom. The season is 14 series of four.",
    "Open a player for the scouting report. In camp, two young farm hands can take the extra winter reps.",
    "Security is the job. The owner reviews you when the year ends. At zero, the chair is gone.",
  ];
  const last = ui.tutorial >= steps.length - 1;
  return `<div class="modal-back"><div class="modal" role="dialog"><div class="kicker">The first week</div><h3>${esc(steps[ui.tutorial])}</h3><div class="row-actions"><button type="button" class="btn-ghost" data-act="tutorial-skip">Skip</button><button type="button" class="btn-primary" data-act="tutorial-next">${last ? "To the desk" : "Next"}</button></div></div></div>`;
}

function toastsHtml() {
  const inShell = career && ui.screen === "game" && !(career.phase === "legacy" && ui.view !== "trophies");
  if (inShell) return "";
  return `<div class="toasts">${ui.toasts.map((t) => `<div class="toast ${t.kind}" data-toast="${t.id}">${esc(t.text)}</div>`).join("")}</div>`;
}

function render() {
  prepareDraft();
  const app = $("#app");
  const scroll = $(".stage")?.scrollTop || 0;
  let html = "";
  if (ui.screen === "new") html = viewNew();
  else if (ui.screen === "manual") html = viewManual();
  else if (ui.screen === "settings") html = viewSettings();
  else if (ui.screen === "credits") html = viewCredits();
  else if (!career || ui.screen === "title") html = viewTitle();
  else if (career.phase === "legacy" && ui.view !== "trophies") html = viewLegacy();
  else html = shell(stage());
  app.innerHTML = html + modalHtml() + tutorialHtml() + toastsHtml();
  const stageEl = $(".stage");
  if (stageEl) stageEl.scrollTop = scroll;
}

function gotoGame() {
  ui.screen = "game";
  ui.view = career.phase === "recap" ? "desk" : ui.view || "desk";
  render();
}

function beginCareer() {
  const name = $("#gm-name")?.value || ui.newGame.name;
  ui.newGame.name = name;
  career = createCareer({
    gmName: name,
    teamId: ui.newGame.teamId,
    difficulty: ui.newGame.difficulty,
    situation: ui.newGame.situation,
  });
  ui.view = viewForPhase(career.phase, null) || "desk";
  ui.phaseSeen = career.phase;
  ui.playerId = null;
  ui.tutorial = 0;
  ui.trade.teamId = career.teams.find((t) => t.id !== career.userTeamId).id;
  consumeToasts();
  autosave();
  playConfirm();
  gotoGame();
}

function loadAutosave() {
  try {
    career = hydrate(localStorage.getItem("foc-autosave"));
    ui.view = viewForPhase(career.phase, null) || "desk";
    ui.phaseSeen = career.phase;
    gotoGame();
  } catch (err) {
    toast(err.message || "That save could not be read.");
    render();
  }
}

function exportSave() {
  if (!career) return;
  const blob = new Blob([serialize(career)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `front-office-corner-${career.year}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function onClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  resumeAudio(ui.settings);
  const act = el.dataset.act;
  const go = (fn, sound) => {
    const result = fn();
    after(result, sound);
  };
  if (act === "nav") {
    ui.view = el.dataset.view;
    ui.playerId = null;
    playClick();
    render();
    return;
  }
  if (act === "title") { ui.screen = "title"; ui.modal = null; playClick(); render(); return; }
  if (act === "goto-new") { ui.screen = "new"; playClick(); render(); return; }
  if (act === "goto-manual") { ui.returnScreen = career && ui.screen === "game" ? "game" : "title"; ui.modal = null; ui.screen = "manual"; playClick(); render(); return; }
  if (act === "back-manual") { ui.screen = ui.returnScreen || (career ? "game" : "title"); playClick(); render(); return; }
  if (act === "goto-settings") { ui.returnScreen = career && ui.screen === "game" ? "game" : "title"; ui.modal = null; ui.screen = "settings"; playClick(); render(); return; }
  if (act === "goto-credits") { ui.returnScreen = career && ui.screen === "game" ? "game" : "title"; ui.modal = null; ui.screen = "credits"; playClick(); render(); return; }
  if (act === "goto-load") { $("#import-file")?.click(); return; }
  if (act === "continue") { loadAutosave(); return; }
  if (act === "pick-diff") { ui.newGame.difficulty = el.dataset.id; playClick(); render(); return; }
  if (act === "pick-sit") { ui.newGame.situation = el.dataset.id; playClick(); render(); return; }
  if (act === "pick-team") { ui.newGame.teamId = el.dataset.id; playClick(); render(); return; }
  if (act === "begin") { beginCareer(); return; }
  if (act === "menu") {
    ui.modal = { title: "Office", body: "The career is saved on this machine as you play.", yes: "Close", kind: "menu" };
    render();
    return;
  }
  if (act === "modal-no") { ui.modal = null; render(); return; }
  if (act === "modal-yes") {
    const modal = ui.modal;
    ui.modal = null;
    if (!modal) return;
    if (modal.kind === "october") go(() => simToOctober(career), "week");
    else if (modal.kind === "release") go(() => releasePlayer(career, modal.id));
    else if (modal.kind === "retire") go(() => retireGm(career));
    else if (modal.kind === "menu") {
      ui.modal = null;
      render();
    } else render();
    return;
  }
  if (act === "sim-day") {
    const before = career.lastBox;
    const result = simDay(career);
    const won = career.lastBox && career.lastBox !== before && career.lastBox.winner === career.userTeamId;
    after(result, won ? "win" : result?.ok === false ? "click" : "loss");
    return;
  }
  if (act === "sim-week") go(() => simWeek(career), "week");
  if (act === "sim-october") {
    if (ui.settings.confirmSim) {
      ui.modal = { title: "Sim to October?", body: "The rest of the regular season will play out. Inbox offers you have not answered will expire.", yes: "Sim it", kind: "october" };
      render();
    } else go(() => simToOctober(career), "week");
    return;
  }
  if (act === "sim-playoff") go(() => simPlayoffDay(career), "week");
  if (act === "sim-october-rest") go(() => simRestOfOctober(career), "week");
  if (act === "open-season") go(() => openSeason(career), "confirm");
  if (act === "ack-recap") go(() => ackRecap(career), "confirm");
  if (act === "file-tenders") go(() => fileTenders(career), "confirm");
  if (act === "advance-fa") go(() => advanceFreeAgency(career), "week");
  if (act === "open-camp") go(() => openCamp(career), "confirm");
  if (act === "draft-best") {
    const result = draftBestAvailable(career);
    advanceDraftCpu(career);
    after(result, "confirm");
    return;
  }
  if (act === "draft") {
    const result = draftSelect(career, el.dataset.id);
    advanceDraftCpu(career);
    after(result, "confirm");
    return;
  }
  if (act === "player") { ui.playerId = el.dataset.id; ui.view = "roster"; playClick(); render(); return; }
  if (act === "inbox") go(() => respondInbox(career, el.dataset.id, el.dataset.choice));
  if (act === "focus") go(() => setFocus(career, el.dataset.id));
  if (act === "plan") go(() => setPlan(career, el.dataset.id));
  if (act === "tender") { setTender(career, el.dataset.id, el.dataset.yes === "1"); playClick(); render(); return; }
  if (act === "bid") {
    const years = Number(document.getElementById(`y-${el.dataset.id}`)?.value);
    const salary = Number(document.getElementById(`s-${el.dataset.id}`)?.value);
    go(() => placeFaBid(career, el.dataset.id, years, salary));
    return;
  }
  if (act === "trade-toggle") {
    const side = el.dataset.side === "send" ? "send" : "recv";
    const list = ui.trade[side];
    const idx = list.indexOf(el.dataset.id);
    if (idx >= 0) list.splice(idx, 1);
    else if (list.length < 4) list.push(el.dataset.id);
    playClick();
    render();
    return;
  }
  if (act === "trade-submit") {
    const result = submitTrade(career, ui.trade.teamId, ui.trade.send, ui.trade.recv, ui.trade.cashSend, ui.trade.cashRecv);
    if (result?.ok) {
      ui.trade.send = [];
      ui.trade.recv = [];
    }
    after(result, "confirm");
    return;
  }
  if (act === "auto-lineup") go(() => autoSetLineup(career));
  if (act === "auto-rotation") go(() => autoSetRotation(career));
  if (act === "block") go(() => setBlock(career, el.dataset.id, !career.players[el.dataset.id].onBlock));
  if (act === "promote") go(() => promote(career, el.dataset.id));
  if (act === "demote") go(() => demote(career, el.dataset.id));
  if (act === "release-ask") {
    ui.modal = { title: "Release this player?", body: "Veterans leave most of the remaining money on the books.", yes: "Release", kind: "release", id: el.dataset.id };
    render();
    return;
  }
  if (act === "tutorial-next") {
    ui.tutorial += 1;
    if (ui.tutorial >= 4) { setTutorialSeen(career); autosave(); }
    playClick();
    render();
    return;
  }
  if (act === "tutorial-skip") { setTutorialSeen(career); autosave(); playClick(); render(); return; }
  if (act === "export") { exportSave(); return; }
  if (act === "retire-ask") {
    ui.modal = { title: "Leave the chair?", body: "You can retire on your own terms. The owner will not be the one who decides.", yes: "Retire", kind: "retire" };
    render();
  }
}

function onChange(e) {
  const el = e.target;
  if (el.dataset.act === "lineup") {
    const team = userTeamOf(career);
    const entries = team.lineup.map((s) => ({ ...s }));
    const index = Number(el.dataset.index);
    const playerId = el.value;
    const other = entries.findIndex((s) => s.id === playerId);
    if (other >= 0 && other !== index) {
      const tmp = entries[index].id;
      entries[index].id = playerId;
      entries[other].id = tmp;
    } else entries[index].id = playerId;
    after(setLineup(career, entries));
  } else if (el.dataset.act === "rotation") {
    const team = userTeamOf(career);
    const ids = team.rotation.slice();
    const index = Number(el.dataset.index);
    const other = ids.indexOf(el.value);
    if (other >= 0 && other !== index) {
      const tmp = ids[index];
      ids[index] = el.value;
      ids[other] = tmp;
    } else ids[index] = el.value;
    after(setRotation(career, ids));
  } else if (el.dataset.act === "trade-team") {
    ui.trade.teamId = el.value;
    ui.trade.recv = [];
    render();
  } else if (el.dataset.act === "cash-send") {
    ui.trade.cashSend = Number(el.value) || 0;
    if (ui.trade.cashSend) ui.trade.cashRecv = 0;
    render();
  } else if (el.dataset.act === "cash-recv") {
    ui.trade.cashRecv = Number(el.value) || 0;
    if (ui.trade.cashRecv) ui.trade.cashSend = 0;
    render();
  } else if (el.dataset.act === "staff") {
    setStaff(career, { [el.dataset.key]: Number(el.value) });
    autosave();
    render();
  } else if (el.dataset.act === "setting") {
    ui.settings[el.dataset.key] = Number(el.value);
    saveSettings();
  } else if (el.dataset.act === "check") {
    ui.settings[el.dataset.key] = el.checked;
    saveSettings();
    render();
  }
}

function onSubmit(e) {
  const form = e.target.closest("form[data-act='extend']");
  if (!form) return;
  e.preventDefault();
  const years = form.elements.years.value;
  const salary = form.elements.salary.value;
  after(offerExtension(career, form.dataset.id, years, salary), "confirm");
}

function onKey(e) {
  if (e.target.matches("input, textarea, select")) return;
  const key = e.key.toLowerCase();
  if (key === "escape") {
    if (ui.screen === "manual" || ui.screen === "settings" || ui.screen === "credits" || ui.screen === "new") {
      ui.screen = ui.returnScreen || (career ? "game" : "title");
      ui.modal = null;
      render();
      return;
    }
    if (!career || ui.screen !== "game") return;
    if (ui.modal) { ui.modal = null; render(); return; }
    ui.view = "desk";
    ui.playerId = null;
    render();
    return;
  }
  if (!career || ui.screen !== "game") return;
  const map = { d: "sim-day", w: "sim-week", o: "sim-october", r: "roster", t: "market", f: "books", n: "wire", b: "standings", l: "leaders", p: "october", y: "trophies", m: "manual" };
  if (key === "m") { ui.returnScreen = "game"; ui.screen = "manual"; render(); return; }
  if (map[key] === "sim-day" || map[key] === "sim-week" || map[key] === "sim-october") {
    document.querySelector(`[data-act="${map[key]}"]`)?.click();
    return;
  }
  if (VIEWS.some(([id]) => id === map[key])) { ui.view = map[key]; ui.playerId = null; render(); }
}

async function boot() {
  loadSettings();
  saveSettings();
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("submit", onSubmit);
  window.addEventListener("keydown", onKey);
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.id = "import-file";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      career = hydrate(await file.text());
      ui.screen = "game";
      ui.phaseSeen = career.phase;
      ui.view = viewForPhase(career.phase, null) || "desk";
      autosave();
      toast("Save loaded.");
      render();
    } catch (err) {
      toast(err.message || "That file is not a Front Office Corner save.");
      render();
    }
  });
  document.body.appendChild(input);
  if (window.foc?.readAutosave) {
    try {
      const file = await window.foc.readAutosave();
      if (file) localStorage.setItem("foc-autosave", file);
    } catch { /* the browser build keeps saves in localStorage */ }
  }
  const params = new URLSearchParams(location.search);
  if (params.get("quick") === "1") {
    career = createCareer({ seed: Number(params.get("seed") || 7), teamId: params.get("team") || "gulls", gmName: "Jordan Hale", situation: params.get("sit") || "standard" });
    setTutorialSeen(career);
    ui.screen = "game";
    ui.phaseSeen = career.phase;
    ui.view = "desk";
    autosave();
  }
  render();
}

export { boot, ui };
