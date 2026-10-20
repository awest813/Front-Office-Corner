import { overall } from "./roster.js";
import { fullName, hashStr } from "./util.js";

const QUIRKS = [
  "He takes early batting practice alone.",
  "The catchers say he shakes off the first sign.",
  "He keeps a paper book of every at-bat.",
  "He is first on the field and last in the dugout.",
  "Teammates say the music in his stall is too loud.",
  "He talks to the umpire and then lets it go.",
  "He will not bunt unless the card says so.",
  "The trainers know his name before the coaches do.",
  "He studies the other pitcher from the bench.",
  "He wants the ball when the inning is messy.",
  "He laughs in the clubhouse and goes quiet in the box.",
  "He remembers every park he has ever disliked.",
  "The staff trusts him with a one-run lead.",
  "He asks for the scouting packet the night before.",
  "He runs the bases like the throw is already coming.",
  "He will play hurt, and the trainers wish he would not.",
];

const PERSONALITY = {
  loyal: "He would rather stay than shop the market.",
  mercenary: "He knows what the open market pays.",
  volatile: "The clubhouse feels it when he sits.",
  even: "He shows up and does the job.",
};

export function playerRole(p) {
  if (!p) return "player";
  if (p.isPitcher) {
    if (p.role === "RP" && p.stuff >= 62) return "late innings";
    if (p.stuff >= 64) return "power arm";
    if (p.control >= 62) return "command arm";
    if (p.movement >= 62) return "ground-ball arm";
    if (p.stamina >= 64 && p.role === "SP") return "innings eater";
    return p.role === "SP" ? "starter" : "reliever";
  }
  if (p.age <= 22 && (p.potential || 0) >= overall(p) + 8) return "prospect";
  if (p.power >= 64 && p.power >= p.contact) return "slugger";
  if (p.contact >= 62 && p.power < 55) return "contact bat";
  if (p.defense >= 64 && p.pos !== "DH") return "glove";
  if (p.speed >= 64) return "runner";
  if (p.eye >= 64) return "patient bat";
  if (overall(p) >= 60) return "regular";
  return "bench piece";
}

function toolSentence(p) {
  const tools = p.isPitcher
    ? [["stuff", p.stuff], ["control", p.control], ["movement", p.movement], ["stamina", p.stamina]]
    : [["contact", p.contact], ["power", p.power], ["eye", p.eye], ["speed", p.speed], ["defense", p.defense], ["arm", p.arm]];
  const ranked = tools.slice().sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  return `The carrying tool is ${best[0]} (${best[1]}). The soft tool is ${worst[0]} (${worst[1]}).`;
}

export function playerReport(p, fog = 0) {
  if (!p) return "";
  const name = fullName(p);
  const role = playerRole(p);
  if (fog >= 8) {
    return `${name} looks like a ${role} from the seats. The file is still thin, and the number on the card is a guess.`;
  }
  const personality = PERSONALITY[p.personality] || "He keeps his own counsel.";
  const tool = fog >= 3 ? `The shape of a ${role} is the part the scouts agree on.` : toolSentence(p);
  const control = (p.service || 0) >= 6
    ? "He can reach the open market when the deal ends."
    : (p.service || 0) >= 3
      ? "Arbitration is the next argument."
      : "The club still controls the salary.";
  const clock = p.age <= 23
    ? `At ${p.age} there is still time in the tools.`
    : p.age >= 33
      ? `At ${p.age} the present skills are the story.`
      : `${name} is ${p.age}.`;
  const quirk = QUIRKS[hashStr(p.id) % QUIRKS.length];
  return `${clock} ${tool} ${personality} ${control} ${quirk}`;
}
