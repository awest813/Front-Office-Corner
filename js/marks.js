const ICONS = {
  desk: `<path d="M4 15h16M7 15v3M17 15v3M8 15V8h8v7"/><path d="M12 8V5"/>`,
  roster: `<path d="M8 7h11M8 12h11M8 17h7"/><path d="M5 7h.01M5 12h.01M5 17h.01"/>`,
  standings: `<path d="M4 19h16M8 19V9h3v10M13 19V5h3v14"/>`,
  scores: `<path d="M12 3.5 19 10.5 12 17.5 5 10.5z"/><path d="M12 8v5"/>`,
  wire: `<path d="M4 6h16v12H4z"/><path d="M4 10h16M8 14h6"/>`,
  market: `<path d="M4 9h16l-1.5 9h-13z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>`,
  books: `<path d="M6 4h11v16H6z"/><path d="M6 8h11M10 4v16"/>`,
  leaders: `<path d="M12 3.5 14.2 9H20l-4.6 3.4L17.2 18 12 14.8 6.8 18l1.8-5.6L4 9h5.8z"/>`,
  october: `<path d="M6 4v16"/><path d="M6 5h9l-2.2 3.2L15 11.5H6"/>`,
  trophies: `<path d="M8 5h8v6a4 4 0 0 1-8 0z"/><path d="M8 7H5.5A2.5 2.5 0 0 0 8 10"/><path d="M16 7h2.5A2.5 2.5 0 0 1 16 10"/><path d="M12 15v2.5"/><path d="M9 20h6"/>`,
  bats: `<path d="M15 3.5 19 7.5 8.5 18 5 19.5 6.5 16z"/><path d="M13.5 5.5 17 9"/>`,
  arms: `<circle cx="12" cy="12" r="7"/><path d="M9.2 8.2c1.6 1.8 1.6 5.8 0 7.6M14.8 8.2c-1.6 1.8-1.6 5.8 0 7.6"/>`,
  gloves: `<path d="M8 11c0-3 1.8-5 4-5s4 2 4 5c1.6.2 3 1.6 3 3.6 0 3.2-2.8 5.4-7 5.4S5 17.8 5 14.6C5 12.6 6.4 11.2 8 11z"/><path d="M9 10.5V8M12 10V7.5M15 11V9"/>`,
  rest: `<path d="M16 14.5A6.5 6.5 0 1 1 9.5 5 5.2 5.2 0 0 0 16 14.5z"/>`,
  inbox: `<path d="M4 7h16v11H4z"/><path d="M4 7l8 6 8-6"/>`,
  slate: `<path d="M7 4h10v16H7z"/><path d="M10 8h4M10 12h4M10 16h2"/>`,
  goals: `<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/>`,
  series: `<path d="M12 4l6 6-6 6-6-6z"/>`,
  week: `<path d="M5 6h14v13H5z"/><path d="M5 10h14M8 4v4M16 4v4"/>`,
  diamond: `<path d="M12 3l7 9-7 9-7-9z"/>`,
};

const CRESTS = {
  gulls: `<path fill="currentColor" d="M12 34c7-1 12-7 20-8 8-1 14 3 20 6-8 0-13 2-20 2s-13-1-20 0z"/><path fill="currentColor" d="M34 24c3-7 9-8 12-6-4 2-6 6-7 10-3-1-4-2-5-4z"/>`,
  ospreys: `<path fill="currentColor" d="M6 32c10-8 18-10 26-6 8-4 16-2 26 6-10 1-18 0-26 4-8-4-16-3-26-4z"/><path fill="currentColor" d="M30 24c2-8 5-10 7-8 1 4-1 8-2 12l-3 8c-2-4-3-8-2-12z"/>`,
  pilots: `<path fill="currentColor" d="M32 16a16 16 0 1 0 0 32 16 16 0 0 0 0-32zm0 6a10 10 0 1 1 0 20 10 10 0 0 1 0-20z"/><path fill="currentColor" d="M30 14h4v36h-4zM14 30h36v4H14z"/>`,
  lanterns: `<path fill="currentColor" d="M29 16h6l-1 4h-4zM24 20h16l-2 18H26zM28 38h8l-1 6h-6z"/><path fill="currentColor" d="M30 24h4v8h-4z" opacity="0.35"/>`,
  oxen: `<path fill="currentColor" d="M24 34c0-8 4-14 8-14s8 6 8 14-3 14-8 14-8-6-8-14z"/><path fill="currentColor" d="M24 30C14 16 8 20 12 30c2 4 7 5 10 2zM40 30c10-14 16-10 12 0-2 4-7 5-10 2z"/>`,
  forge: `<path fill="currentColor" d="M14 26h32l3 6H12zM20 32h20v5H20zM26 37h8v8h-8z"/>`,
  herons: `<circle cx="42" cy="18" r="3.5" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M40 21c-4 6-10 8-12 14"/><ellipse cx="26" cy="38" rx="9" ry="5" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M22 42v8M30 42v8"/>`,
  stags: `<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M32 46V26M32 30l-8-8M24 22l-6-6M24 22l5-1M32 28l8-9M40 19l6-6M40 19l-5-1M26 34l-5 2M38 34l5 2"/>`,
  moons: `<path fill="currentColor" d="M38 16a16 16 0 1 0 0 32 18 18 0 1 1 0-32z"/>`,
  roustabouts: `<circle cx="32" cy="16" r="4" fill="currentColor"/><path fill="currentColor" d="M30 20h4v16h-4z"/><path fill="currentColor" fill-rule="evenodd" d="M12 32h8c1 8 6 12 12 12s11-4 12-12h8c-1 12-9 18-20 18S13 44 12 32z"/>`,
  dunes: `<path fill="currentColor" d="M10 42c6-10 10-10 16 0 4-12 10-14 18-8v8H10z"/>`,
  jackals: `<path fill="currentColor" d="M14 14l10 12-2 4v16h20V30l-2-4 10-12-8 6-6-4-6 4z"/>`,
  aurora: `<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M16 40c4-14 10-20 16-20s12 6 16 20M20 40c3-10 7-14 12-14s9 4 12 14M24 40c2-6 4-8 8-8s6 2 8 8"/>`,
  martens: `<ellipse cx="28" cy="36" rx="12" ry="7" fill="currentColor"/><circle cx="40" cy="30" r="5" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" d="M18 34c-8-2-10-12-4-14"/>`,
  breakers: `<path fill="currentColor" d="M10 28c4 0 4-6 8-6s4 6 8 6 4-6 8-6 4 6 8 6v6H10zM12 38h40v4H12z"/>`,
  choir: `<path fill="currentColor" d="M28 16h6v20a7 7 0 1 1-6-6z"/><path fill="currentColor" d="M34 16c8 1 12 5 12 10h-6c0-2-2-4-6-4z"/>`,
  wheat: `<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M32 46V18M32 22c-4-1-6-4-6-4s0 5 2 7M32 28c4-1 6-4 6-4s0 5-2 7M32 34c-4-1-6-4-6-4s0 5 2 7M32 40c4-1 6-4 6-4s0 5-2 7"/>`,
  express: `<path fill="currentColor" d="M16 36V24h22l8 8v4zM18 40a4 4 0 1 0 0.1 0zM38 40a4 4 0 1 0 0.1 0z"/><path fill="currentColor" d="M20 26h8v6h-8z" opacity="0.35"/>`,
  bells: `<path fill="currentColor" d="M32 14a2 2 0 1 0 0.1 0zM24 22h16l4 16H20zM22 38h20v3H22zM30 41h4v5h-4z"/>`,
  otters: `<ellipse cx="30" cy="34" rx="11" ry="8" fill="currentColor"/><circle cx="40" cy="30" r="5.5" fill="currentColor"/><path fill="currentColor" d="M18 38c-8 6-8 12-2 12 6 0 8-4 10-8z"/>`,
  ore: `<path fill="currentColor" d="M18 42l20-22 6 6-20 22zM16 44l6-2 2 6-6 2z"/><path fill="currentColor" d="M36 16l8 8" stroke="currentColor" stroke-width="3"/>`,
  firs: `<path fill="currentColor" d="M32 12l12 14H36l8 12H18l8-12h-8zM28 38h8v8h-8z"/>`,
  condors: `<path fill="currentColor" d="M4 34c8-12 16-14 22-8 2-8 6-10 8-10s6 2 8 10c6-6 14-4 22 8-8 2-14 6-22 8l-4 8h-8l-4-8c-8-2-14-6-22-8z"/>`,
  fog: `<path fill="currentColor" d="M14 24h28v3H14zM18 32h32v3H18zM12 40h30v3H12z" opacity="0.9"/>`,
};

export function icon(name) {
  const body = ICONS[name] || ICONS.diamond;
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

export function crest(id) {
  return CRESTS[id] || CRESTS.gulls;
}

export const CREST_IDS = Object.keys(CRESTS);
