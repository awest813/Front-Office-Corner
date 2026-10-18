let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let started = false;
let musicNodes = [];

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(ctx.destination);
}

export function setVolumes(settings) {
  if (!ctx) return;
  const m = settings.muted ? 0 : settings.master ?? 0.8;
  master.gain.value = m;
  musicGain.gain.value = settings.music ?? 0.35;
  sfxGain.gain.value = settings.sfx ?? 0.7;
}

export function resumeAudio(settings) {
  try {
    ensure();
    if (!ctx) return;
    setVolumes(settings);
    if (ctx.state === "suspended") ctx.resume();
    if (!started && !settings.muted && (settings.music ?? 0) > 0) startMusic();
    started = true;
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, type, gain, when = 0, slide) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playClick() {
  tone(520, 0.05, "triangle", 0.04);
}

export function playConfirm() {
  tone(392, 0.08, "triangle", 0.05, 0);
  tone(523, 0.12, "triangle", 0.05, 0.07);
}

export function playWeek() {
  tone(196, 0.1, "sine", 0.03, 0);
  tone(247, 0.14, "sine", 0.03, 0.08);
}

export function playWin() {
  tone(523, 0.1, "triangle", 0.05, 0);
  tone(659, 0.1, "triangle", 0.05, 0.09);
  tone(784, 0.18, "triangle", 0.05, 0.18);
}

export function playLoss() {
  tone(311, 0.14, "sine", 0.04, 0, 180);
}

export function playTrophy() {
  tone(523, 0.08, "square", 0.03, 0);
  tone(659, 0.08, "square", 0.03, 0.08);
  tone(784, 0.08, "square", 0.03, 0.16);
  tone(1046, 0.22, "triangle", 0.04, 0.24);
}

function startMusic() {
  if (!ctx || musicNodes.length) return;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 720;
  filter.connect(musicGain);
  const notes = [196, 220, 247, 262, 294, 330, 349];
  const make = (offset, interval) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    let step = offset;
    const tick = () => {
      if (!ctx) return;
      const freq = notes[step % notes.length] / (step % 11 === 0 ? 2 : 1);
      const t = ctx.currentTime;
      osc.frequency.setTargetAtTime(freq, t, 0.08);
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018, t + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + interval * 0.92);
      step += 2;
    };
    tick();
    const timer = setInterval(tick, interval * 1000);
    musicNodes.push({ osc, timer });
  };
  make(0, 2.8);
  make(3, 3.6);
}

export function stopMusic() {
  for (const node of musicNodes) {
    clearInterval(node.timer);
    try { node.osc.stop(); } catch { /* already stopped */ }
  }
  musicNodes = [];
}

export function syncMusic(settings) {
  if (!ctx) return;
  setVolumes(settings);
  if (settings.muted || (settings.music ?? 0) <= 0) stopMusic();
  else if (started) startMusic();
}
