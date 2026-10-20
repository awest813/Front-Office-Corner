export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const api = {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) {
      if (n <= 1) return 0;
      return Math.floor(api.next() * n);
    },
    intRange(lo, hi) {
      return lo + api.int(hi - lo + 1);
    },
    pick(arr) {
      return arr[api.int(arr.length)];
    },
    chance(p) {
      return api.next() < p;
    },
    float(lo, hi) {
      return lo + api.next() * (hi - lo);
    },
    state() {
      return a >>> 0;
    },
    setState(s) {
      a = (s >>> 0) || 1;
    },
  };
  return api;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fmtAvg(h, ab) {
  if (!ab) return ".000";
  const v = h / ab;
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(3).slice(1);
}

export function fmtEra(er, outs) {
  if (!outs) return "0.00";
  return ((er * 27) / outs).toFixed(2);
}

export function fmtIp(outs) {
  const o = outs | 0;
  return `${(o / 3) | 0}.${o % 3}`;
}

export function fmtPct(w, l) {
  const g = w + l;
  if (!g) return ".000";
  const v = w / g;
  if (v >= 1) return "1.000";
  return v.toFixed(3).slice(1);
}

export function fmtMoney(m, digits = 2) {
  const n = Number(m) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(digits)}M`;
}

export function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

export function possessive(name) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function fullName(p) {
  return `${p.first} ${p.last}`;
}

export function shortName(p) {
  return `${p.first.slice(0, 1)}. ${p.last}`;
}

export function teamLabel(t) {
  return `${t.city} ${t.name}`;
}

export function mutate(state, fn) {
  const rng = makeRng(1);
  rng.setState(state.rng);
  const result = fn(rng);
  state.rng = rng.state();
  return result;
}
