// Decides which theme is "live" today.
//   theme: "<name>"  -> always that theme
//   theme: "rotate"  -> a different theme from rotate_list each day
//   theme: "random"  -> a random theme each day
// With auto.festivals / auto.seasons on, festival and season themes take
// over on their dates, then it falls back to the choice above.
import { THEME_NAMES } from './themes.mjs';
import { hash } from './svg.mjs';

// Festival dates move every year. Diwali 2026-2028 and Holi 2026 match
// Drik Panchang; later years are estimates. Add or correct years in your
// config under "festival_dates", e.g. { "holi": { "2028": "2028-03-11" } }.
const FESTIVALS = {
  diwali: { 2025: '2025-10-20', 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' },
  holi: { 2026: '2026-03-04', 2027: '2027-03-22', 2028: '2028-03-11', 2029: '2029-03-01', 2030: '2030-03-20' },
};

const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

export function localDate(timezone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function festivalFor(dateISO, cfg) {
  const year = dateISO.slice(0, 4), md = dateISO.slice(5);
  const dates = { diwali: { ...FESTIVALS.diwali, ...(cfg.festival_dates?.diwali || {}) }, holi: { ...FESTIVALS.holi, ...(cfg.festival_dates?.holi || {}) } };
  if (md >= '12-31' || md <= '01-02') return 'new-year';
  if (dates.diwali[year]) { const d = dayDiff(dateISO, dates.diwali[year]); if (d >= -3 && d <= 2) return 'diwali'; }
  if (dates.holi[year]) { const d = dayDiff(dateISO, dates.holi[year]); if (d >= -1 && d <= 1) return 'holi'; }
  if (md >= '10-25' && md <= '10-31') return 'halloween';
  return null;
}

function seasonFor(dateISO) {
  const md = dateISO.slice(5);
  if (md >= '12-01' || md <= '02-15') return 'winter-night';
  if (md >= '03-15' && md <= '04-30') return 'sakura-dusk';
  if (md >= '10-01' && md <= '11-25') return 'autumn';
  return null;
}

function base(cfg, dateISO, choice) {
  if (choice === 'rotate') {
    const list = (cfg.rotate_list?.length ? cfg.rotate_list : THEME_NAMES).filter((n) => THEME_NAMES.includes(n));
    const doy = dayDiff(dateISO, dateISO.slice(0, 4) + '-01-01');
    return list[doy % list.length];
  }
  if (choice === 'random') return THEME_NAMES[hash(dateISO) % THEME_NAMES.length];
  return choice;
}

export function selectThemes(cfg, dateISO, override) {
  const check = (n) => { if (!THEME_NAMES.includes(n)) throw new Error(`Unknown theme "${n}". Options: ${THEME_NAMES.join(', ')}, rotate, random`); return n; };
  if (override) { const n = check(base(cfg, dateISO, override)); return { dark: n, light: n, reason: 'manual override' }; }
  const auto = cfg.auto || {};
  const fest = auto.festivals ? festivalFor(dateISO, cfg) : null;
  if (fest) return { dark: fest, light: fest, reason: `festival: ${fest}` };
  const season = auto.seasons ? seasonFor(dateISO) : null;
  if (season) return { dark: season, light: check(cfg.light_theme || 'github-light'), reason: `season: ${season}` };
  return { dark: check(base(cfg, dateISO, cfg.theme || 'classic-blue')), light: check(cfg.light_theme || 'github-light'), reason: 'configured theme' };
}
