# Steam release checklist

Front Office Corner ships as an Electron window around the same files the browser build uses. Steamworks binaries are not in this repository. Create the app, the depot, and the achievement API names on the partner site, then upload a build with the Steamworks SDK you download from there.

## Play and test before you upload

```bash
npm test
npm run balance
npm run serve
```

Open `http://127.0.0.1:4173/`. `?quick=1` skips the tutorial. Optional query keys: `seed`, `team`, `sit` (`contender`, `standard`, `rebuild`).

## Desktop build

Install the shell on the machine that will upload (it is not required to run the tests):

```bash
npm install --save-dev electron electron-builder
npx electron-builder --win    # or --mac, or --linux
```

`electron-builder.yml` writes `dist/`. The Windows upload root is `dist/win-unpacked/`. Point `steam/app_build.vdf` at the unpacked folder for the platform you are shipping, and replace `YOUR_APP_ID` and `YOUR_DEPOT_ID`.

```bash
# From a Steamworks SDK install, after the ids are filled in:
steamcmd +login YOUR_ACCOUNT +run_app_build ../steam/app_build.vdf +quit
```

For a local Steam client smoke test only, copy `steam/steam_appid.txt.example` to `steam_appid.txt` beside the executable. `480` is Spacewar. Remove that file from any build you upload to your own app id.

## Saves and cloud

The browser build stores the career in `localStorage` (`foc-autosave`) and settings in `foc-settings`. Export writes a JSON file you can load from the title screen.

The Electron build also writes `userData/saves/autosave.json` through a preload bridge. That folder is the one to list if you turn on Steam Cloud. The renderer cannot choose the path.

Save version is 1 (`SAVE_VERSION` in `js/data.js`).

## Achievements

In-game trophies are granted locally and listed in the trophy case. `steam/achievements.json` matches `js/achieve.js`. The Electron shell forwards a new unlock to Steam when `steamworks.js` is installed beside the app.

The bridge is optional. It is not an npm dependency, and the Steamworks redistributables are not in this repository. Install the module only on the machine that packages a build:

```bash
npm install steamworks.js
```

`electron/steam.cjs` reads the app id from `FOC_STEAM_APP_ID`, then from `steam_appid.txt` in the working directory, beside the executable, in `resources`, or at the project root. It does not read `steam/steam_appid.txt.example`. `480` is Spacewar and is only for a local client test. Do not put `steam_appid.txt` in an uploaded depot. If the module or the app id is missing, the game still runs and the trophy case still fills in.

On the partner site, create API names that match the `id` field. The overlay call runs before the window opens. A restart through Steam, when Steam asks for one, quits this process instead of opening a second window.

## Store page

Use `steam/STORE.md` for the short and long descriptions, tags, requirements, and the content survey. The survey answers are: no violence, no sexual content, no strong language, no gambling, no multiplayer, no in-game purchases.

## Partner steps this repo cannot do

1. Create the app and the default depot. Paste the ids into `steam/app_build.vdf`.
2. Upload capsules from the title screen. Sizes are listed in `steam/STORE.md`.
3. Set the launch options to the Electron executable. No command-line arguments are required.
4. Price, platforms, and the build review.
5. If Steam achievements should pop, add the API names from `steam/achievements.json` and `npm install steamworks.js` on the packaging machine. Do not commit the SDK redistributables. Leave `steam_appid.txt` out of the depot.
6. Run the store-page content survey with the answers in `steam/STORE.md`.

## What “done” means for a first public build

- `npm test` and `npm run balance` pass.
- A career can be started, simulated through October, tendered, taken through free agency, and drafted.
- Continue, export, and load round-trip a save.
- The manual, settings, and credits open from the title screen and from the office menu.
- The build runs windowed at 1280×720 and at 1440×900.
- The store description does not name a real league, club, or player.
