export const SAVE_VERSION = 1;
export const GAME_VERSION = "1.3.0";
export const MIN_SALARY = 0.74;
export const LUXURY = 165;
export const DEADLINE_WEEK = 10;
export const ACTIVE_MAX = 26;
export const FARM_MAX = 16;
export const SEASON_WEEKS = 14;
export const SERIES_DAYS = 4;
export const OPENING_YEAR = 2026;

export const FIELD_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

export const FIRST_NAMES = [
  "Adrian", "Miles", "Jonah", "Cesar", "Andre", "Luis", "Marco", "Evan", "Noah", "Felix",
  "Oscar", "Hugo", "Ivan", "Rafael", "Nico", "Samuel", "Julian", "Grant", "Calvin", "Edgar",
  "Harvey", "Leon", "Omar", "Pablo", "Ruben", "Sergio", "Tomas", "Victor", "Wesley", "Arthur",
  "Bennett", "Callum", "Darius", "Emilio", "Finn", "Gideon", "Hector", "Isaiah", "Javier", "Kai",
  "Lorenzo", "Malik", "Nolan", "Owen", "Quentin", "Roman", "Silas", "Theo", "Uriel", "Wade",
  "Xavier", "Yusef", "Abel", "Bruno", "Caleb", "Diego", "Eli", "Franco", "Gus", "Hank",
  "Idris", "Joel", "Knox", "Leo", "Mateo", "Nash", "Orion", "Paolo", "Reed", "Shane",
  "Tariq", "Vince", "Will", "Amos", "Bodhi", "Cruz", "Desmond", "Enzo", "Farid", "Gio",
];

export const LAST_NAMES = [
  "Adler", "Bancroft", "Cho", "Duarte", "Ellison", "Farrow", "Gallegos", "Herrera", "Ibarra", "Johansson",
  "Keene", "Lang", "Moreau", "Nakamura", "Okonkwo", "Paredes", "Quintero", "Rinaldi", "Sato", "Tremblay",
  "Ueda", "Varga", "Whitaker", "Yamamoto", "Zuniga", "Almeida", "Bergstrom", "Crowley", "Dalton", "Espinoza",
  "Fontaine", "Gresham", "Haddad", "Iversen", "Janacek", "Kowalski", "Leclerc", "Mbeki", "Nielsen", "Osei",
  "Petrov", "Rossi", "Silva", "Takahashi", "Underwood", "Vogel", "Walsh", "Xu", "Yilmaz", "Zimmerman",
  "Archer", "Beltran", "Costa", "Drayton", "Ekwueme", "Ferris", "Gupta", "Holm", "Ito", "Jensen",
  "Kapoor", "Larsen", "Mwangi", "Novak", "Okafor", "Pacheco", "Rahman", "Svensson", "Tadesse", "Ulrich",
  "Vasquez", "Wozniak", "Abebe", "Boudreaux", "Castillo", "Dempsey", "Falk", "Greer", "Huxley", "Iqbal",
  "Jaramillo", "Khoury", "Lindholm", "Mercer", "Ndiaye", "Ostergaard", "Pruitt", "Reeves", "Shah", "Tolbert",
];

export const PERSONALITIES = ["loyal", "mercenary", "even", "volatile"];

export const TEAMS = [
  { id: "gulls", city: "Harbor City", name: "Gulls", league: "Harbor", division: "East", market: 1.32, budget: 172, park: 1.06, parkName: "Lampblack Park", colors: ["#16324f", "#d7b15a"], outlook: "A big-market chair with October written into the lease.", owner: { name: "Marjorie Voss", style: "win-now" }, blurb: "The waterfront expects a pennant and will say so." },
  { id: "ospreys", city: "Cape Merrin", name: "Ospreys", league: "Harbor", division: "East", market: 1.04, budget: 128, park: 0.98, parkName: "Merrin Bluff", colors: ["#1f6f6a", "#e6d3b1"], outlook: "A patient club on a pretty cliff.", owner: { name: "Helen Cho", style: "patient" }, blurb: "They draft well and apologize to nobody for it." },
  { id: "pilots", city: "Redhook", name: "Pilots", league: "Harbor", division: "East", market: 0.98, budget: 122, park: 1.02, parkName: "Hook Wharf", colors: ["#7e2e2e", "#e7d7c1"], outlook: "A restless mid-market team with a loud owner.", owner: { name: "Sal Vecchio", style: "meddlesome" }, blurb: "The owner calls the desk. Often." },
  { id: "lanterns", city: "Port Selene", name: "Lanterns", league: "Harbor", division: "East", market: 0.84, budget: 98, park: 0.94, parkName: "Selene Field", colors: ["#2c2a6b", "#e2a53a"], outlook: "Small payroll, pitcher-friendly wind, long memories.", owner: { name: "Ida Pell", style: "cheap" }, blurb: "Every dollar is counted twice." },
  { id: "oxen", city: "Millford", name: "Oxen", league: "Harbor", division: "Central", market: 1.0, budget: 124, park: 1.0, parkName: "Oxbow Grounds", colors: ["#6b4423", "#f0e2c8"], outlook: "A steady farm club that wins the months nobody films.", owner: { name: "Ruth Keller", style: "patient" }, blurb: "They would rather grow a player than rent one." },
  { id: "forge", city: "Cinder Falls", name: "Forge", league: "Harbor", division: "Central", market: 1.02, budget: 130, park: 1.09, parkName: "Furnace Yard", colors: ["#8a3e24", "#c0c4c8"], outlook: "A hitter's yard and a win-now front office.", owner: { name: "Anton Bale", style: "win-now" }, blurb: "The ball carries. So do the expectations." },
  { id: "herons", city: "Lake Vesper", name: "Herons", league: "Harbor", division: "Central", market: 0.86, budget: 100, park: 0.96, parkName: "Vesper Lake Field", colors: ["#2f5d8c", "#f4f1ea"], outlook: "Quiet market, careful books, pretty baseball.", owner: { name: "Nora Lind", style: "patient" }, blurb: "A lake town that will wait, within reason." },
  { id: "stags", city: "Ironwood", name: "Stags", league: "Harbor", division: "Central", market: 0.82, budget: 96, park: 0.92, parkName: "Stag Park", colors: ["#2f4a34", "#c4a574"], outlook: "The league's stingiest payroll and a park that swallows flies.", owner: { name: "Clyde Marsh", style: "cheap" }, blurb: "They win with pitching because they cannot buy bats." },
  { id: "moons", city: "Palmetto", name: "Moons", league: "Harbor", division: "South", market: 1.24, budget: 164, park: 1.03, parkName: "Moonflower Grounds", colors: ["#3e2f5b", "#e6d9a2"], outlook: "Old money, new opinions, a meddlesome box.", owner: { name: "Camille Duval", style: "meddlesome" }, blurb: "The owner's friends all have lineup cards." },
  { id: "roustabouts", city: "Saint Cole", name: "Roustabouts", league: "Harbor", division: "South", market: 0.97, budget: 126, park: 1.01, parkName: "Cole Basin", colors: ["#1e4d3a", "#e0b44f"], outlook: "A loud club that wants October this year.", owner: { name: "Buddy Crane", style: "win-now" }, blurb: "The basin does not do five-year plans." },
  { id: "dunes", city: "Solara", name: "Dunes", league: "Harbor", division: "South", market: 1.3, budget: 174, park: 1.12, parkName: "Dune Bowl", colors: ["#c47b3b", "#2a2118"], outlook: "Heat, payroll, and a park that begs for home runs.", owner: { name: "Lila Ortega", style: "win-now" }, blurb: "Stars come here to be seen." },
  { id: "jackals", city: "Copper Mesa", name: "Jackals", league: "Harbor", division: "South", market: 1.0, budget: 120, park: 1.05, parkName: "Mesa Ridge", colors: ["#a3562a", "#1e2a44"], outlook: "A hard market that watches the ledger.", owner: { name: "Hank Ruiz", style: "cheap" }, blurb: "They will spend, then they will regret it out loud." },
  { id: "aurora", city: "Northline", name: "Aurora", league: "Summit", division: "North", market: 1.08, budget: 134, park: 0.97, parkName: "Aurora Yard", colors: ["#3d6b8c", "#c9b6e4"], outlook: "A cold city with a long view.", owner: { name: "Sigrid Holm", style: "patient" }, blurb: "They build through the dark months." },
  { id: "martens", city: "Whitepine", name: "Martens", league: "Summit", division: "North", market: 0.85, budget: 99, park: 0.93, parkName: "Marten Den", colors: ["#1f3d32", "#d9c7a4"], outlook: "Small gate, loyal town, thin margin.", owner: { name: "Pete Lang", style: "patient" }, blurb: "A prospect is a payroll plan." },
  { id: "breakers", city: "Granite Bay", name: "Breakers", league: "Summit", division: "North", market: 0.99, budget: 123, park: 0.99, parkName: "Breakwater Park", colors: ["#4a5560", "#c4493a"], outlook: "A meddlesome port that fires early.", owner: { name: "June Harlow", style: "meddlesome" }, blurb: "The owner reads the box score before you do." },
  { id: "choir", city: "Frostharbor", name: "Choir", league: "Summit", division: "North", market: 0.83, budget: 97, park: 0.95, parkName: "Choir Hill", colors: ["#6d7c8a", "#f7f4ef"], outlook: "A thrifty northern club with a soft park.", owner: { name: "Edith Shaw", style: "cheap" }, blurb: "They hum through rebuilds." },
  { id: "wheat", city: "Prairie Bend", name: "Wheat", league: "Summit", division: "Central", market: 0.96, budget: 121, park: 1.0, parkName: "Wheat Field", colors: ["#b0893f", "#2c2416"], outlook: "Even-tempered baseball in a wide market.", owner: { name: "Tom Albrecht", style: "patient" }, blurb: "They like a clean farm and a quiet August." },
  { id: "express", city: "Crossrail", name: "Express", league: "Summit", division: "Central", market: 1.28, budget: 168, park: 1.04, parkName: "Crossrail Yard", colors: ["#22262c", "#c0c7d1"], outlook: "Rail money and a win-now clock.", owner: { name: "Victor Lang", style: "win-now" }, blurb: "The timetable does not include a rebuild." },
  { id: "bells", city: "Amber Hill", name: "Bells", league: "Summit", division: "Central", market: 1.05, budget: 129, park: 0.98, parkName: "Bell Tower Park", colors: ["#b4532a", "#1d3557"], outlook: "A pretty club with too many voices in the box.", owner: { name: "Frances Pike", style: "meddlesome" }, blurb: "Everyone in Amber Hill has a favorite infielder." },
  { id: "otters", city: "Rivermark", name: "Otters", league: "Summit", division: "Central", market: 0.9, budget: 108, park: 0.97, parkName: "Otter Reach", colors: ["#3e6b62", "#c9844a"], outlook: "A small river town that trusts the desk.", owner: { name: "Will Abebe", style: "patient" }, blurb: "They will give a plan two years. Maybe three." },
  { id: "ore", city: "Goldspan", name: "Ore", league: "Summit", division: "West", market: 1.12, budget: 142, park: 1.1, parkName: "Ore Pit", colors: ["#c6a15b", "#2a241c"], outlook: "A hitter's canyon that wants the flag now.", owner: { name: "Della Quinn", style: "win-now" }, blurb: "The pit turns doubles into noise." },
  { id: "firs", city: "Cascade", name: "Firs", league: "Summit", division: "West", market: 1.01, budget: 125, park: 0.96, parkName: "Fir Valley", colors: ["#1d4a3c", "#d5ddd4"], outlook: "Rain, patience, and a deep system.", owner: { name: "Kenji Sato", style: "patient" }, blurb: "They grow pitchers the way the valley grows trees." },
  { id: "condors", city: "Red Canyon", name: "Condors", league: "Summit", division: "West", market: 0.95, budget: 118, park: 1.08, parkName: "Canyon Mouth", colors: ["#7a2f2f", "#e6d2b5"], outlook: "A dry park and a tighter wallet.", owner: { name: "Rosa Hale", style: "cheap" }, blurb: "They will not pay for your nostalgia." },
  { id: "fog", city: "Sable Coast", name: "Fog", league: "Summit", division: "West", market: 0.88, budget: 104, park: 0.9, parkName: "Fogline Park", colors: ["#5c6168", "#d9dde2"], outlook: "The league's best pitcher's park and a patient owner.", owner: { name: "Arthur Pell", style: "patient" }, blurb: "Fly balls die in the marine layer." },
];

export const MANUAL = [
  {
    title: "The job",
    body: "You are the general manager. The Continental Diamond League has two leagues, Harbor and Summit, each with three divisions of four clubs. Your owner hands you three goals and a budget. Job security moves with the week: sweeps help, losing weeks hurt, and the end of the year is when the chair is actually at risk. At zero, you are dismissed. You may also retire on your own terms from the office menu.",
  },
  {
    title: "The season",
    body: "Each club plays 56 games: 14 series of four. Division rivals meet twice, everyone else in the league once. The desk lists what is still open before you sim: inbox notes, a hurt starter, tenders, the draft clock. Before the first game of a series, name a plan. Bats, arms, or gloves give that side a small lift for four games. Rest shortens the injury list. The plan locks once the series starts. Sim a day, a series, or the rest of the regular season. The last four weeks are after the trade deadline. When the schedule ends, four clubs in each league — three division winners and one wild card — play a best-of-five series, then a best-of-seven league final. The league champions meet in the Continental Series.",
  },
  {
    title: "Ratings",
    body: "Players are graded 20 to 80. The label runs poor, fringe, average, above, plus, and elite. On your own club the number is colored to match that word. A fogged grade stays plain until the scouting staff earns it. Hitters show contact, power, eye, speed, defense, and arm. Pitchers show stuff, control, movement, and stamina. A higher scouting budget clears the fog faster, including on the draft board.",
  },
  {
    title: "Roster and contracts",
    body: "The active roster holds up to 26 players. Everyone else is on the farm. You set the batting order and the defensive positions — catcher through right field, plus a designated hitter — and a five-man rotation. Pre-arbitration players renew near the minimum. After three years of service they are arbitration eligible: tender a contract or let them walk. After six years they hit the open market. An extension's years include the current season. Releasing a veteran leaves most of the remaining money as dead weight. A year on the active roster is a year of service.",
  },
  {
    title: "Trades and free agency",
    body: "Propose trades from the wire desk until the deadline, or answer the offers that arrive in the inbox. The desk's opinion of a deal gets sharper as you fund analytics. In the winter, free agents post a demand. Bid years and salary, then advance the week. Other clubs bid too. Unsigned players lower their ask. Four weeks, then the draft.",
  },
  {
    title: "The draft and the farm",
    body: "Three rounds, worst record picking first. A rebuild also receives a supplemental pick at the end of the first round. Prospects arrive raw. Development spending pushes young players toward their potential each winter; age catches the rest. In camp you may name two farm players, 25 or younger, for the development slate. They get the extra reps, and the desk letter names who rose and who slipped. Promote and demote freely as long as the active roster can still field a team.",
  },
  {
    title: "Reports and the inbox",
    body: "Every player page carries a scouting report. Your own organization is exact. Other clubs stay fogged until scouting wears the error down. During the season the inbox can ask you to call a prospect up, to start a player who wants the card, or to claim a young player another club is letting go. A claim costs $0.40M and needs a farm spot. A note you ignore expires when the next series starts. The trophy case keeps the champions and the award history.",
  },
  {
    title: "Money",
    body: "Tickets, a media allotment, and your market size pay the bills. Payroll, staff, dead money, and a luxury tax over $165M spend them. Staff plans — scouting, development, marketing, and analytics — lock on Opening Day. Marketing fills the park. Cheap owners punish a payroll over the club budget. A profit is its own kind of win.",
  },
  {
    title: "October and the record book",
    body: "You cannot be fired in the middle of a series. Security is settled after the Continental Series, when goals are graded and the owner decides. Awards — MVP, the pitching prize, rookie of the year, reliever, and a defensive honor — are argued from the season's numbers. Your career log keeps every chair you held. Saves live in this browser, and you can export a file for safekeeping.",
  },
  {
    title: "Shortcuts",
    body: "D sims a day. W sims the series. O sims to October. Esc closes a dialog, leaves the manual, or returns to the desk. R roster, T the market, F the books, N the wire, B standings, L leaders, P October, Y trophies, M the manual.",
  },
];

export const SITUATIONS = [
  {
    id: "contender",
    title: "Contender",
    text: "A stronger roster, a louder owner, and a budget already spoken for. October is the assignment.",
  },
  {
    id: "standard",
    title: "As found",
    text: "The club you scouted. No gift, no sabotage. Make it yours.",
  },
  {
    id: "rebuild",
    title: "Rebuild",
    text: "Thinner major-league talent, richer prospects, a patient owner, and a supplemental first-round pick.",
  },
];

export const DIFFICULTIES = [
  {
    id: "lenient",
    title: "Lenient",
    text: "A wider budget, lighter security swings, a kinder trade market, and thinner fog.",
  },
  {
    id: "standard",
    title: "Standard",
    text: "The league as it is. Fair offers, ordinary fog, an owner who remembers.",
  },
  {
    id: "sharp",
    title: "Sharp",
    text: "Tighter money, harsher swings, sharper rival desks, and a deeper fog.",
  },
];
