import { audit, createCareer, leagueReport, simSeasonToRecap } from "../js/career.js";
import { overall } from "../js/roster.js";

const seeds = [1, 7, 11, 21, 42];
let failed = 0;
for (const seed of seeds) {
  const state = createCareer({ seed, teamId: "express", situation: "standard", cpu: true });
  simSeasonToRecap(state);
  const report = leagueReport(state);
  const errors = audit(state);
  const overalls = Object.values(state.players).map((p) => overall(p)).sort((a, b) => b - a);
  const line = [
    `seed ${seed}`,
    `avg ${report.avg.toFixed(3)}`,
    `rpg ${report.rpg.toFixed(2)}`,
    `era ${report.era.toFixed(2)}`,
    `hr ${report.hr}`,
    `top ${overalls[0]}`,
    `65+ ${overalls.filter((n) => n >= 65).length}`,
    errors.length ? `AUDIT ${errors.slice(0, 4).join("; ")}` : "audit ok",
  ].join("  ");
  console.log(line);
  if (errors.length || report.avg < 0.23 || report.avg > 0.29 || report.rpg < 3.4 || report.rpg > 5.6) failed += 1;
}
if (failed) {
  console.error(`${failed} season(s) outside the release band`);
  process.exit(1);
}
