# Front Office Corner — Steam store copy

Replace the placeholders after the app exists in Steamworks. Do not mention real leagues, clubs, or players.

## Short description

Run a fictional baseball club from the corner office. Set the lineup, spend the budget, and keep the owner convinced through a 56-game season.

## Long description

Front Office Corner is a single-player baseball career sim set in the Continental Diamond League, a league that does not exist anywhere else. Twenty-four clubs. Two leagues. You are the general manager.

The job is the game. Security rises and falls with the week, the books, and the promises you made in camp. At zero, the chair is gone. You can also retire on your own terms and leave a record behind.

A year runs from camp to October and on through the winter:

- Fourteen series of four, then a short playoff: division series, league final, Continental Series.
- Lineups, rotations, call-ups, releases, and extensions.
- A trade wire that closes after week ten, and rival offers that arrive already willing to deal.
- Four weeks of free agency, then a three-round draft. A rebuild adds a supplemental pick.
- Scouting fog. Analytics, development, and marketing are budgets you lock on Opening Day.
- A luxury line at $165M, dead money, and an owner who can read a ledger.

Grades run from 20 to 80. Your own organization is a clear report. Everyone else is an estimate until you pay the scouts.

The league, the cities, the clubs, and the people are original. There is no sportsbook, no real-money purchase, and no online mode. Saves stay on your machine. Export a file when you want a copy.

## Tags

Simulation, Sports, Baseball, Management, Strategy, Indie, Singleplayer

## System requirements

| | Minimum | Recommended |
| --- | --- | --- |
| OS | Windows 10 64-bit, macOS 12, or Ubuntu 22.04 | Windows 11, macOS 14, or Ubuntu 24.04 |
| Processor | Dual-core 2 GHz | Quad-core |
| Memory | 4 GB | 8 GB |
| Graphics | Any GPU that can open a window | Same |
| Storage | 400 MB | 400 MB |
| Input | Mouse and keyboard | Mouse and keyboard |
| Display | 1280×720 | 1920×1080 |

The window starts at 1440×900 and will not shrink below 1100×700. There is no gamepad map. Steam Deck is playable with the trackpad acting as a mouse; it is not a verified layout.

## Content survey

- Violence: none
- Sexual content: none
- Language: none
- Drugs and alcohol: none
- Gambling: none. Contracts and a luxury-tax line are club accounting, not wagers.
- User-generated content shared online: none
- Multiplayer or network features: none
- In-game purchases, loot boxes, or random paid items: none
- Age: suitable for a general audience

## Legal line

Front Office Corner and the Continental Diamond League are original fiction. They are not affiliated with, endorsed by, or derived from any real league, club, player, or brand. Personal names in the league are generated. Any resemblance to a real person is unintended.

Typefaces bundled with the game remain under their own licenses: Noto Sans and Noto Serif (SIL Open Font License 1.1) and JetBrains Mono (Apache License 2.0). See `assets/fonts/NOTICES.txt`.

## Capsules

Produce these from the title screen (walnut field, brass wordmark, club seal). Do not use real club marks.

- Header capsule: 920×430
- Small capsule: 462×174
- Main capsule: 1232×706
- Vertical capsule: 748×896
- Library capsule: 600×900
- Library hero: 3840×1240
- Page background: 1438×810

## Achievements

Thirty-one achievements are defined in `steam/achievements.json` and unlocked inside the game. The desktop build forwards those ids to Steam when `steamworks.js` is installed. Hidden ones are Perfect, The Cycle, Pink Slip, and Hall of Fame. Create matching API names in Steamworks before a public build, using the `id` field as the API name.
