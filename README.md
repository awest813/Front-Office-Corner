# Front Office Corner

A single-player baseball general-manager sim. You run one club in the Continental Diamond League, a fictional twenty-four team league, and try to keep the job through camp, a 56-game season, October, and the winter.

The clubs, cities, and people are original. The game does not use real leagues, real clubs, or sports betting.

## Play

Any static file server works. From this folder:

```bash
npm run serve
```

Then open http://127.0.0.1:4173/

`http://127.0.0.1:4173/?quick=1` starts a career and skips the first-week notes. Add `seed`, `team` (a club id such as `gulls`), and `sit` (`contender`, `standard`, or `rebuild`) if you want a specific chair.

The desktop shell is Electron. Tests do not need it.

```bash
npm install --save-dev electron
npm start
```

Packaging and the Steamworks steps that require a partner account are in [steam/RELEASE.md](steam/RELEASE.md). Store text is in [steam/STORE.md](steam/STORE.md).

## How a year works

Camp, then fourteen series of four. Trades close after week ten. October is a division series, a league final, and the Continental Series. The winter is tenders, four weeks of free agency, and a three-round draft. A rebuild receives a supplemental pick at the end of round one.

Grades run from 20 to 80. Your own roster is exact. Other clubs are scouted with fog unless you spend on analytics and scouting. The series card keeps the four scores and the arm you are sending. Your own games keep a play-by-play on the score. It stays quiet on their side until that fog lifts, then it names their arm and their bat. Every player page carries a scouting report. Staff budgets lock on Opening Day. In camp you can name two young farm players for the development slate; they get the extra winter reps, and the desk letter says who rose. During the season the inbox can ask for a call-up, a lineup change, or a $0.40M claim. The desk lists what is still open, the clubhouse line reads the room and names the quiet end and the sharp end, and before each series you name a plan: bats, arms, gloves, or rest. Before Opening Day you name a posture for the roster: push, bridge, or shop. The ledger board shows the thin spots, the spare bats, and the deals that end this year. The luxury line is $165M. The trophy case keeps the champions and the award history.

Job security is the loss condition during the season and at the year-end review. You can retire from the office menu.

## Keys

D day, W series, O sim to October, Esc close or back to the desk, R roster, T market, F books, N wire, B standings, S scores, L leaders, P October, Y trophies, M manual.

## Saves

The browser build autosaves to this machine (`localStorage`) and can export or load a JSON file from the title screen and the office menu. The Electron build also writes `userData/saves/autosave.json`.

## Tests

```bash
npm test
npm run balance
```

`npm test` checks the schedule, a full season, a three-year CPU career, and a save round-trip. `npm run balance` prints batting average, runs per game, and ERA for five seeds and exits nonzero if a season leaves the release band.

## Credits

The score is generated in the game. Noto Sans, Noto Serif, and JetBrains Mono are bundled under the licenses in `assets/fonts/`.
