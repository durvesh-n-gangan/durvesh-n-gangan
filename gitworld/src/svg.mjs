// Small helpers for building SVG markup as strings.
// Every generated file must stand alone: no scripts, no external assets.

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (const c of String(str)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) so a city looks the same every day
// unless the underlying data changes.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const r1 = (v) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10);

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function E(tag, attrs = {}, children) {
  let a = '';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false || v === '') continue;
    a += ` ${k}="${esc(typeof v === 'number' ? r1(v) : v)}"`;
  }
  return children === undefined || children === null || children === ''
    ? `<${tag}${a}/>`
    : `<${tag}${a}>${children}</${tag}>`;
}

export const pick = (R, arr) => arr[Math.floor(R() * arr.length)];

// Inline animation style. Negative delays start each loop mid-way so
// nothing visibly "starts" when the image loads.
export function anim(name, dur, { delay = 0, timing = 'linear', dir = '', extra = '' } = {}) {
  return `animation:${name} ${r1(dur)}s ${timing} infinite${dir ? ' ' + dir : ''};animation-delay:-${r1(delay)}s;${extra}`;
}

export const twinkle = (R, min = 2, span = 4) =>
  `animation-duration:${r1(min + R() * span)}s;animation-delay:-${r1(R() * span)}s`;

// Rough width of 11px monospace text.
export const textW = (s, size = 11) => String(s).length * size * 0.61;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
