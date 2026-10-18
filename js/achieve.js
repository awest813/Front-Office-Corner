export const ACHIEVEMENTS = [
  { id: "first_light", name: "First Light", desc: "Win a game.", hidden: false },
  { id: "sweep", name: "Clean Series", desc: "Sweep a series.", hidden: false },
  { id: "october", name: "October Bound", desc: "Reach the playoffs.", hidden: false },
  { id: "pennant", name: "Pennant", desc: "Win a league final.", hidden: false },
  { id: "title", name: "The Corner Office", desc: "Win the Continental Series.", hidden: false },
  { id: "dynasty", name: "Dynasty", desc: "Win three Continental Series.", hidden: false },
  { id: "heavy", name: "Heavy Favorite", desc: "Win 36 games in a season.", hidden: false },
  { id: "profit", name: "In the Black", desc: "Turn a profit.", hidden: false },
  { id: "five_black", name: "Five Clean Books", desc: "Turn a profit in five seasons.", hidden: false },
  { id: "bargain", name: "Bargain Hunter", desc: "Sign a real player well under market.", hidden: false },
  { id: "blockbuster", name: "Blockbuster", desc: "Finish a trade involving four or more players.", hidden: false },
  { id: "roy", name: "The Kid", desc: "Have your player win Rookie of the Year.", hidden: false },
  { id: "homegrown", name: "Homegrown", desc: "Have a player you drafted win MVP.", hidden: false },
  { id: "firesale", name: "Tear-down", desc: "Trade away three veterans, then win a title within six years.", hidden: false },
  { id: "perfect", name: "Perfect", desc: "Have your staff throw a perfect game.", hidden: true },
  { id: "nono", name: "No-No", desc: "Have your staff throw a no-hitter.", hidden: false },
  { id: "cycle", name: "The Cycle", desc: "Have a player hit for the cycle.", hidden: true },
  { id: "longball", name: "The Long Ball", desc: "Have a player hit 16 home runs.", hidden: false },
  { id: "ironman", name: "Ironman", desc: "Have a player appear in all 56 games.", hidden: false },
  { id: "pink", name: "Pink Slip", desc: "Get fired.", hidden: true },
  { id: "lifer", name: "Lifer", desc: "Finish 15 seasons in the chair.", hidden: false },
  { id: "small_title", name: "Small Market Banner", desc: "Win a title with a bottom-five payroll.", hidden: false },
  { id: "all_in", name: "All In", desc: "Win a title in a year you bought at the deadline.", hidden: false },
  { id: "prospect", name: "Can't Miss", desc: "Draft a prospect with 70-grade potential.", hidden: false },
  { id: "cy", name: "Ace", desc: "Have your pitcher win the pitching prize.", hidden: false },
  { id: "sellout", name: "Sellout", desc: "Pack the park.", hidden: false },
  { id: "comeback", name: "Comeback", desc: "Win a title after your chair was in real trouble.", hidden: false },
  { id: "manual", name: "Read the Manual", desc: "Read the front-office manual.", hidden: false },
  { id: "untouchable", name: "Untouchable", desc: "Finish a season with security at 100.", hidden: false },
  { id: "clean", name: "Under the Line", desc: "Finish with no dead money and payroll under the luxury line.", hidden: false },
  { id: "hall", name: "Hall of Fame", desc: "Retire after 10 seasons with at least one title.", hidden: true },
];

export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

function unlock(state, id) {
  if (state.achievements[id]) return null;
  state.achievements[id] = { year: state.year, week: state.week };
  const def = achievementById(id);
  return def ? def.name : id;
}

export function evaluateAchievements(state) {
  const m = state.meta || {};
  const fresh = [];
  const give = (id, cond) => {
    if (cond) {
      const name = unlock(state, id);
      if (name) fresh.push(name);
    }
  };
  give("first_light", (m.careerWins || 0) > 0);
  give("sweep", (m.sweeps || 0) > 0);
  give("october", (m.playoffs || 0) > 0);
  give("pennant", (m.pennants || 0) > 0);
  give("title", (m.titles || 0) > 0);
  give("dynasty", (m.titles || 0) >= 3);
  give("heavy", !!m.heavy);
  give("profit", (m.blackSeasons || 0) > 0);
  give("five_black", (m.blackSeasons || 0) >= 5);
  give("bargain", !!m.bargain);
  give("blockbuster", !!m.blockbuster);
  give("roy", !!m.roy);
  give("homegrown", !!m.homegrownMvp);
  give("firesale", !!m.firesaleTitle);
  give("perfect", (m.perfectGames || 0) > 0);
  give("nono", (m.noHitters || 0) > 0);
  give("cycle", (m.cycles || 0) > 0);
  give("longball", !!m.longball);
  give("ironman", !!m.ironman);
  give("pink", !!state.gm?.fired);
  give("lifer", (m.seasons || 0) >= 15);
  give("small_title", !!m.lowPayrollTitle);
  give("all_in", !!m.buyerTitle);
  give("prospect", !!m.cantMiss);
  give("cy", !!m.cy);
  give("sellout", !!m.sellout);
  give("comeback", !!m.comebackTitle);
  give("manual", !!m.readManual);
  give("untouchable", !!m.jobPerfect);
  give("clean", !!m.cleanBooks);
  give("hall", !!state.gm?.retired && (m.seasons || 0) >= 10 && (m.titles || 0) >= 1);
  return fresh;
}
