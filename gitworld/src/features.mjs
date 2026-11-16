// Feature library. Each feature draws one layer of decoration and reads
// only real data from ctx.data. A feature whose data is missing returns ''
// so nothing is ever invented.
//
// Layers, back to front:
//   sky    -> after the sky colors, before the far skyline
//   back   -> after the far skyline, before the main buildings
//   mid    -> on top of the buildings
//   street -> on the ground, behind the road traffic
//   front  -> in front of everything except the labels
//   ui     -> labels and legends
import { E, anim, pick, twinkle, textW, clamp, r1, esc } from './svg.mjs';

const tall = (ctx) => ctx.city.filter((b) => !b.small);
const landmarks = (ctx) => ctx.city.filter((b) => b.repo);
const spread = (arr, n) => {
  if (n >= arr.length) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(((i + 0.5) * arr.length) / n)]);
  return out;
};
const MONO = 'monospace';

// Where the commit billboard sits, so signs can stay out of its way.
function billboardRect(ctx, width = 172) {
  if (!(ctx.data.recent_commits || []).length) return null;
  const cands = [...landmarks(ctx), ...tall(ctx)].filter((b) => b.y - 36 >= 34).sort((a, b) => b.h - a.h);
  const b = cands[0];
  if (!b) return null;
  return { b, x: clamp(b.x + b.w / 2 - width / 2, 10, 890 - width), y: b.y - 36, width };
}
const hasFeature = (ctx, name) => ctx.t.features.some((f) => (Array.isArray(f) ? f[0] : f) === name);
const SANS = 'Segoe UI, Helvetica, Arial, sans-serif';

function falling(ctx, { count, shape, colors, name, dur = [6, 7], startY = 40 }) {
  const R = ctx.R;
  let s = '';
  for (let k = 0; k < count; k++) {
    const x = R() * 1000;
    const y = R() * startY - 10;
    const c = pick(R, colors);
    const d = dur[0] + R() * dur[1];
    const st = anim(name, d, { delay: R() * d });
    if (shape === 'dot') s += E('circle', { cx: x, cy: y, r: 0.8 + R() * 1.6, fill: c, opacity: 0.9, style: st });
    else if (shape === 'petal') s += E('ellipse', { cx: x, cy: y, rx: 2.6, ry: 1.5, fill: c, class: 'fb', style: st });
    else if (shape === 'leaf') s += E('path', { d: `M${r1(x)} ${r1(y)}q4-5 8 0q-4 5-8 0z`, fill: c, class: 'fb', style: st });
    else if (shape === 'confetti') s += E('rect', { x, y, width: 3, height: 5, fill: c, class: 'fb', style: st });
  }
  return s;
}

export const FEATURES = {
  // ---------- sky ----------
  lightning: {
    layer: 'sky',
    // A storm far behind the city: every few seconds the sky flickers and a
    // bolt shows for a moment. The buildings stay dark against the flash.
    draw(ctx, o = {}) {
      const { color = '#c9d4ff', bolt = '#f4f6ff', x = 610, every = 9 } = o;
      const flash = anim('flash', every);
      let s = E('rect', { x: 0, y: 0, width: 900, height: 210, fill: color, opacity: 0, style: flash });
      s += E('path', { d: `M${x} 0l-14 34l10 2l-18 38l8 2l-12 30l26-40l-10-2l16-34l-9-2l10-28z`, fill: bolt, opacity: 0, style: flash });
      return s;
    },
  },
  moon: {
    layer: 'sky',
    // Moon phase = days since your last contribution (full moon = today).
    draw(ctx, o = {}) {
      const { x = 250, y = 58, r = 11, color = '#ffd866', glow = true, phase = true } = o;
      const d = ctx.data.days_since_last;
      const ph = phase && d != null ? clamp(d, 0, 14) / 14 : 0;
      let s = '';
      if (glow && ph < 0.5) s += E('circle', { cx: x, cy: y, r: r * 1.9, fill: color, opacity: 0.1 });
      s += E('circle', { cx: x, cy: y, r, fill: color });
      if (ph > 0.04) s += E('circle', { cx: x + 2 * r * (1 - ph) + 0.5, cy: y - 0.5, r: r + 0.6, fill: ctx.skyAt(y) });
      return s;
    },
  },
  sun: {
    layer: 'sky',
    draw(ctx, o = {}) {
      const { x = 120, y = 50, r = 18, color = '#ffd166', glow = 0.18, rays = null } = o;
      let s = '';
      if (glow) s += E('circle', { cx: x, cy: y, r: r * 1.7, fill: color, opacity: glow });
      if (rays) {
        let d = '';
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          d += `M${r1(x + Math.cos(a) * (r + 5))} ${r1(y + Math.sin(a) * (r + 5))}L${r1(x + Math.cos(a) * (r + 12))} ${r1(y + Math.sin(a) * (r + 12))}`;
        }
        s += E('path', { d, stroke: rays, 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'fb', style: anim('spin', 30) });
      }
      return s + E('circle', { cx: x, cy: y, r, fill: color });
    },
  },
  retroSun: {
    layer: 'sky',
    draw(ctx, o = {}) {
      const { x = 450, y = 150, r = 68, colors = ['#ffe066', '#ffc34d', '#ff9a4d', '#ff6f61', '#ff4f8b', '#e0379e'] } = o;
      ctx.defs.push(E('clipPath', { id: 'rsun' }, E('circle', { cx: x, cy: y, r })));
      const n = colors.length, band = (2 * r) / n;
      let g = '';
      colors.forEach((c, i) => {
        const gap = i >= n / 2 ? (i - n / 2 + 1) * 2.2 : 0;
        g += E('rect', { x: x - r, y: y - r + i * band, width: 2 * r, height: band - gap, fill: c });
      });
      return E('circle', { cx: x, cy: y, r: r * 1.25, fill: colors[2], opacity: 0.12 }) + E('g', { 'clip-path': 'url(#rsun)' }, g);
    },
  },
  clouds: {
    layer: 'sky',
    draw(ctx, o = {}) {
      const { color = '#ffffff', stroke = null, count = 3, y = 34, speed = 70, opacity = 1, pixel = false } = o;
      const R = ctx.R;
      let s = '';
      for (let i = 0; i < count; i++) {
        const cy = y + R() * 30, cx = R() * 200;
        const sw = stroke ? 1 : undefined;
        const c = pixel
          ? E('rect', { x: cx, y: cy, width: 40, height: 9, fill: color }) + E('rect', { x: cx + 9, y: cy - 8, width: 20, height: 9, fill: color })
          : E('ellipse', { cx, cy, rx: 30, ry: 9, fill: color, stroke, 'stroke-width': sw }) +
            E('ellipse', { cx: cx + 12, cy: cy - 8, rx: 15, ry: 10, fill: color, stroke, 'stroke-width': sw });
        s += E('g', { opacity: opacity < 1 ? opacity : undefined, style: anim('drift', speed, { delay: (i * speed) / count + R() * 5 }) }, c);
      }
      return s;
    },
  },
  shootingStar: {
    layer: 'sky',
    // Only appears if one of your repos was starred in the last 14 days.
    draw(ctx, o = {}) {
      const d = ctx.data.new_star_days;
      if (d == null || d > 14) return '';
      const { color = '#ffffff' } = o;
      return E('g', { style: anim('shoot', 7) },
        E('line', { x1: 760, y1: 30, x2: 800, y2: 14, stroke: color, 'stroke-width': 1.5, 'stroke-linecap': 'round' }) +
        E('circle', { cx: 760, cy: 30, r: 2, fill: color }));
    },
  },
  aurora: {
    layer: 'sky',
    // Brighter when you've been active this week.
    draw(ctx, o = {}) {
      const { colors = ['#3dffb0', '#57e8ff', '#7affc8'], rays = ['#5dffb8', '#9dffd9', '#c59bff'] } = o;
      const k = 0.55 + 0.45 * clamp((ctx.data.week || 0) / 10, 0, 1);
      const R = ctx.R;
      let s = '';
      // Vertical light rays give the curtains their texture.
      for (let x = 0; x < 900; x += 5) {
        const top = 16 + 10 * Math.sin(x * 0.013) + 6 * Math.sin(x * 0.041);
        const bot = top + 46 + 22 * Math.sin(x * 0.027 + 1);
        s += E('line', { x1: x, y1: top, x2: x + 3, y2: bot, stroke: pick(R, rays), 'stroke-width': 2, opacity: r1((0.1 + R() * 0.2) * k), class: 'tw', style: twinkle(R, 3, 5) });
      }
      colors.forEach((c, i) => {
        const id = 'aur' + i;
        ctx.defs.push(E('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
          E('stop', { offset: 0, 'stop-color': c, 'stop-opacity': 0 }) +
          E('stop', { offset: 0.55, 'stop-color': c, 'stop-opacity': 0.35 }) +
          E('stop', { offset: 0.85, 'stop-color': c, 'stop-opacity': 0.95 }) +
          E('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 })));
        const y0 = 6 + i * 10, amp = 12 + i * 4, depth = 70 - i * 8;
        let d = `M-120 ${y0}`;
        let flip = 1;
        for (let x = -120; x < 1020; x += 60) { d += ` Q${x + 30} ${y0 + flip * amp} ${x + 60} ${y0}`; flip = -flip; }
        d += ` L1020 ${y0 + depth}`;
        for (let x = 1020; x > -120; x -= 60) { d += ` Q${x - 30} ${y0 + depth + flip * amp * 0.7} ${x - 60} ${y0 + depth}`; flip = -flip; }
        d += 'Z';
        s += E('path', { d, fill: `url(#${id})`, opacity: r1(k * (1 - i * 0.12)), class: 'fb', style: anim('auro', 9 + i * 3, { timing: 'ease-in-out', dir: 'alternate', delay: i * 2 }) });
      });
      return s;
    },
  },
  lightRays: {
    layer: 'sky',
    draw(ctx, o = {}) {
      const { color = '#bff3ff' } = o;
      return [[120, 60], [330, 90], [600, 70], [800, 50]]
        .map((r, k) => E('polygon', { points: `${r[0]},0 ${r[0] + r[1]},0 ${r1(r[0] + r[1] * 2.2)},210 ${r1(r[0] + r[1] * 0.8)},210`, fill: color, opacity: 0.07, style: anim('ray', 4 + k, { timing: 'ease-in-out' }) }))
        .join('');
    },
  },
  earth: {
    layer: 'sky',
    draw(ctx, o = {}) {
      const { x = 700, y = 62, r = 26 } = o;
      return E('circle', { cx: x, cy: y, r: r * 1.35, fill: '#4da3ff', opacity: 0.12 }) +
        E('circle', { cx: x, cy: y, r, fill: '#2f7bd8' }) +
        E('path', { d: `M${x - 14} ${y - 10}q8-8 16-2q6 6-2 10q-8 2-6 10q-10-2-8-18zM${x + 6} ${y + 6}q10-4 14 4q-4 10-14 8z`, fill: '#4fbf6a' }) +
        E('path', { d: `M${x - 20} ${y + 4}q10-4 18 0M${x + 2} ${y - 16}q8-3 14 1`, stroke: '#ffffff', 'stroke-width': 2.5, 'stroke-linecap': 'round', fill: 'none', opacity: 0.8 }) +
        E('path', { d: `M${x} ${y - r}a${r} ${r} 0 0 1 0 ${2 * r}a${r * 0.55} ${r} 0 0 0 0 ${-2 * r}z`, fill: '#000000', opacity: 0.35 });
    },
  },
  twoMoons: {
    layer: 'sky',
    draw() {
      return E('circle', { cx: 620, cy: 44, r: 9, fill: '#e8c9b0' }) + E('circle', { cx: 617, cy: 42, r: 2, fill: '#cfae94' }) +
        E('circle', { cx: 690, cy: 72, r: 5, fill: '#d6b49a' });
    },
  },

  // ---------- back ----------
  searchlights: {
    layer: 'back',
    draw(ctx, o = {}) {
      const { color = '#fffbe6', xs = [150, 470, 760] } = o;
      return xs.map((x, i) => E('polygon', {
        points: `${x},210 ${x - 26},0 ${x + 26},0`, fill: color, opacity: 0.09,
        style: `transform-box:view-box;transform-origin:${x}px 210px;` + anim('sweep', 6 + i * 1.5, { timing: 'ease-in-out', dir: 'alternate', delay: i * 2 }),
      })).join('');
    },
  },
  codeRain: {
    layer: 'back',
    draw(ctx, o = {}) {
      const { color = '#00ff66', head = '#d6ffe6', count = 34 } = o;
      const R = ctx.R, G = '01{}<>=+*/;#$%&@ABCDEF'.split('');
      let s = '';
      for (let i = 0; i < count; i++) {
        const x = r1(8 + i * (884 / count) + R() * 8), len = 6 + Math.floor(R() * 10);
        let sp = '';
        for (let k = 0; k < len; k++) {
          sp += E('tspan', { x, dy: k ? 12 : 0, fill: k === len - 1 ? head : color, opacity: k === len - 1 ? 1 : r1(0.2 + (0.6 * k) / len) }, esc(pick(R, G)));
        }
        const d = 4 + R() * 5;
        s += E('text', { x, y: -len * 12, 'font-family': MONO, 'font-size': 11, style: anim('crain', d, { delay: R() * d }) }, sp);
      }
      return s;
    },
  },

  // ---------- mid (on buildings) ----------
  signs: {
    layer: 'mid',
    // Neon signs with your real repo names on the landmark towers.
    draw(ctx, o = {}) {
      const { colors = ['#ff4fd8', '#36e2ff', '#ffd36b', '#7ee787', '#ff7b72', '#a371f7'], bg = '#05060c' } = o;
      const bb = hasFeature(ctx, 'billboard') ? billboardRect(ctx) : null;
      let s = '', i = 0;
      for (const b of landmarks(ctx)) {
        // Signs may hang a little past the tower edges.
        const max = Math.floor((b.w + 12) / 6.7);
        if (max < 4) continue;
        let name = b.repo.name;
        if (name.length > max) name = name.slice(0, max - 1) + '…';
        const w = textW(name) + 10, x = b.x + b.w / 2 - w / 2, y = b.y + 12, c = colors[i % colors.length];
        if (bb && x < bb.x + bb.width && x + w > bb.x && y < bb.y + 40) continue;
        i++;
        s += E('g', { style: anim('neon', 3 + (i % 4) * 0.9, { delay: i }) },
          E('rect', { x, y, width: w, height: 16, rx: 3, fill: bg, stroke: c, 'stroke-width': 1.5 }) +
          E('text', { x: x + w / 2, y: y + 12, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 11, fill: c }, esc(name)));
      }
      return s;
    },
  },
  billboard: {
    layer: 'mid',
    // Scrolls your latest real commit messages. Hidden if there are none.
    draw(ctx, o = {}) {
      const msgs = (ctx.data.recent_commits || []).slice(0, 4);
      const { border = '#58a6ff', color = '#7ee787', bg = '#0d1117' } = o;
      const rect = billboardRect(ctx);
      if (!rect) return '';
      const { b, x: bx, y: by, width } = rect;
      const msg = msgs.map((m) => m.split('\n')[0].slice(0, 60)).join('   ·   ') + '   ·   ';
      const L = textW(msg);
      ctx.css.push(`@keyframes tick{to{transform:translateX(-${r1(L)}px)}}`);
      ctx.defs.push(E('clipPath', { id: 'bbclip' }, E('rect', { x: bx + 4, y: by + 2, width: width - 8, height: 20 })));
      const t = E('text', { x: bx + 6, y: by + 16, 'font-family': MONO, 'font-size': 11, fill: color }, esc(msg)) +
        E('text', { x: bx + 6 + L, y: by + 16, 'font-family': MONO, 'font-size': 11, fill: color }, esc(msg));
      return E('rect', { x: b.x + b.w / 2 - 2, y: by + 24, width: 4, height: 12, fill: '#8b949e' }) +
        E('rect', { x: bx, y: by, width, height: 24, rx: 3, fill: bg, stroke: border, 'stroke-width': 1.5 }) +
        E('g', { 'clip-path': 'url(#bbclip)' }, E('g', { style: anim('tick', L / 38) }, t));
    },
  },
  snowCaps: {
    layer: 'mid',
    draw(ctx, o = {}) {
      const { color = '#f4f8ff' } = o;
      return ctx.city.map((b) => b.small
        ? E('polygon', { points: `${r1(b.x + 3)},${r1(b.y - 3)} ${r1(b.x + b.w / 2)},${r1(b.y - 10)} ${r1(b.x + b.w - 3)},${r1(b.y - 3)}`, fill: color })
        : E('rect', { x: b.x - 1.5, y: b.y - 3, width: b.w + 3, height: 6, rx: 3, fill: color })).join('');
    },
  },
  chimneySmoke: {
    layer: 'mid',
    draw(ctx, o = {}) {
      const { color = '#c8d3e6', chimney = '#3b4f7c' } = o;
      let s = '';
      ctx.city.filter((b) => b.small).forEach((b, i) => {
        const cx = b.x + b.w - 7;
        s += E('rect', { x: cx - 3, y: b.y - 12, width: 6, height: 9, fill: chimney });
        for (let p = 0; p < 3; p++) s += E('circle', { cx, cy: b.y - 15, r: 4, fill: color, class: 'fb', style: anim('puff', 3, { timing: 'ease-out', delay: p + i * 0.3 }) });
      });
      return s;
    },
  },
  lanterns: {
    layer: 'mid',
    draw(ctx, o = {}) {
      const { colors = ['#ff6b6b', '#ffd166', '#ff9f43', '#ff7ad9'], wire = '#6b4a2c' } = o;
      const T = tall(ctx), R = ctx.R;
      let s = '';
      for (let k = 0; k < T.length - 1; k += 2) {
        const a = T[k], b = T[k + 1];
        const x1 = a.x + a.w / 2, y1 = a.y + 8, x2 = b.x + b.w / 2, y2 = b.y + 8;
        const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 26;
        s += E('path', { d: `M${r1(x1)} ${r1(y1)}Q${r1(mx)} ${r1(my)} ${r1(x2)} ${r1(y2)}`, fill: 'none', stroke: wire, 'stroke-width': 1 });
        let j = 0;
        for (let t = 0.1; t < 0.95; t += 0.12) {
          const q = 1 - t, px = q * q * x1 + 2 * q * t * mx + t * t * x2, py = q * q * y1 + 2 * q * t * my + t * t * y2;
          s += E('circle', { cx: px, cy: py + 2, r: 2.3, fill: colors[j++ % colors.length], class: 'tw', style: twinkle(R, 1, 1.5) });
        }
      }
      return s;
    },
  },
  coins: {
    layer: 'mid',
    // One coin per contribution this week (max 10).
    draw(ctx, o = {}) {
      const n = Math.min(10, ctx.data.week || 0);
      if (!n) return '';
      const { fill = '#9bbc0f', edge = '#0f380f' } = o;
      return spread(tall(ctx), n).map((b, k) => E('g', { style: anim('coin', 2.8, { timing: 'ease-out', delay: k * 0.7 }) },
        E('rect', { x: b.x + b.w / 2 - 4, y: b.y - 14, width: 8, height: 10, fill, stroke: edge, 'stroke-width': 1.5 }) +
        E('rect', { x: b.x + b.w / 2 - 1, y: b.y - 12, width: 2, height: 6, fill: edge }))).join('');
    },
  },
  splashes: {
    layer: 'mid',
    draw(ctx, o = {}) {
      const { colors = ['#ff5fa2', '#ffb000', '#2ec4b6', '#7b5cff', '#3ad16b'] } = o;
      const R = ctx.R;
      let s = '';
      for (const b of tall(ctx)) {
        const n = 1 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          const cx = b.x + 4 + R() * (b.w - 8), cy = b.y + 6 + R() * Math.min(b.h - 12, 60), c = pick(R, colors);
          s += E('circle', { cx, cy, r: 4 + R() * 5, fill: c, opacity: 0.55 }) + E('circle', { cx: cx + 6, cy: cy + 4, r: 1.6, fill: c, opacity: 0.6 });
        }
      }
      return s;
    },
  },
  flyingCars: {
    layer: 'mid',
    draw(ctx, o = {}) {
      const { lanes = [70, 100, 132], colors = ['#2de2e6', '#ff9e3d', '#ff4fd8'] } = o;
      const R = ctx.R;
      let s = '';
      lanes.forEach((y, i) => {
        const left = i % 2 === 0, dur = 6 + R() * 6, c = colors[i % colors.length];
        s += E('g', { style: anim(left ? 'carL' : 'carR', dur, { delay: R() * dur }) },
          E('path', { d: `M10 ${y}h${left ? -32 : 32}`, stroke: c, 'stroke-width': 2, opacity: 0.55 }) +
          E('rect', { x: 4, y: y - 2.5, width: 13, height: 5, rx: 2, fill: '#e8e6ff' }) +
          E('rect', { x: left ? 15 : 2, y: y - 1, width: 3, height: 2, fill: c }));
      });
      return s;
    },
  },

  // ---------- street ----------
  trees: {
    layer: 'street',
    // With bloom:'streak' the trees get fuller as your streak grows.
    draw(ctx, o = {}) {
      const { trunk = '#5a3a2c', canopy = ['#ffb7cf', '#ff9ec0'], spacing = 74, y = 212, bloom = null } = o;
      const R = ctx.R;
      const k = bloom === 'streak' ? clamp(((ctx.data.streak || 0) + 1) / 8, 0.35, 1) : 1;
      let s = '';
      for (let tx = 30; tx < 900; tx += spacing) {
        s += E('rect', { x: tx - 1.5, y: y - 16, width: 3, height: 17, fill: trunk });
        let g = '';
        [[0, -20, 10], [-8, -14, 7], [8, -14, 7], [0, -12, 8], [-5, -25, 6], [6, -24, 6]].forEach((c, j) => {
          if (j < 3 || R() < k) g += E('circle', { cx: tx + c[0], cy: y + c[1] - 2, r: c[2] * (0.75 + 0.25 * k), fill: pick(R, canopy) });
        });
        s += E('g', { class: 'fb', style: anim('sway', 4, { timing: 'ease-in-out', delay: R() * 4 }) }, g);
      }
      return s;
    },
  },
  diyas: {
    layer: 'street',
    draw(ctx) {
      const R = ctx.R;
      let s = '';
      for (let k = 0; k < 22; k++) {
        const x = 20 + k * 41;
        s += E('path', { d: `M${x - 6} 252q6 7 12 0z`, fill: '#c46a2c' }) +
          E('ellipse', { cx: x, cy: 247, rx: 2.2, ry: 4.5, fill: '#ffcf5c', class: 'fb', style: anim('flick', 0.4 + R() * 0.4, { timing: 'ease-in-out' }) });
      }
      return s;
    },
  },
  palms: {
    layer: 'street',
    draw(ctx, o = {}) {
      const { trunk = '#8a5a3c', leaf = '#2f9e5b', xs = [40, 230, 520, 760, 870] } = o;
      const R = ctx.R;
      return xs.map((x) => {
        const top = 160 + R() * 20;
        let leaves = '';
        [[-28, 6], [-16, -10], [0, -14], [16, -10], [28, 6]].forEach((l) => {
          leaves += E('path', { d: `M${x + 6} ${r1(top)}q${l[0] / 2} ${l[1] - 8} ${l[0]} ${l[1] + 8}`, fill: 'none', stroke: leaf, 'stroke-width': 4, 'stroke-linecap': 'round' });
        });
        return E('path', { d: `M${x} 214q4-${r1((214 - top) / 2)} 6-${r1(214 - top)}`, fill: 'none', stroke: trunk, 'stroke-width': 4.5, 'stroke-linecap': 'round' }) +
          E('g', { class: 'fb', style: anim('sway', 3.5, { timing: 'ease-in-out', delay: R() * 3 }) }, leaves);
      }).join('');
    },
  },
  pumpkins: {
    layer: 'street',
    draw(ctx) {
      const R = ctx.R;
      let s = '';
      for (let k = 0; k < 9; k++) {
        const x = 40 + k * 100 + R() * 20, y = 214;
        s += E('ellipse', { cx: x, cy: y, rx: 8, ry: 6, fill: '#ff8a1f' }) + E('rect', { x: x - 1, y: y - 9, width: 2, height: 4, fill: '#3a7d2c' }) +
          E('path', { d: `M${r1(x - 4)} ${y - 1}l1.5-2 1.5 2zM${r1(x + 1)} ${y - 1}l1.5-2 1.5 2zM${r1(x - 3)} ${y + 2}h6`, fill: '#ffe066', stroke: '#ffe066', 'stroke-width': 0.8, class: 'tw', style: twinkle(R, 1, 1) });
      }
      return s;
    },
  },
  kelp: {
    layer: 'street',
    draw(ctx) {
      const R = ctx.R;
      let s = '';
      for (let k = 0; k < 26; k++) {
        const kx = r1(12 + k * 35 + R() * 10);
        s += E('path', { d: `M${kx} 213q-6-14 0-28q6-12 0-24`, fill: 'none', stroke: '#2e8b57', 'stroke-width': 3, 'stroke-linecap': 'round', style: `transform-box:fill-box;transform-origin:bottom;` + anim('sway', 3 + R() * 2, { timing: 'ease-in-out' }) });
      }
      return s;
    },
  },
  glare: {
    layer: 'street',
    draw(ctx, o = {}) {
      // Sun shimmer on the street: short broken streaks, not solid bars.
      const { x = 470, color = '#ffb35c' } = o;
      const R = ctx.R;
      let s = '';
      for (let k = 0; k < 14; k++) {
        const w = 10 + R() * 26, y = 213 + k * 3.2;
        s += E('rect', { x: x - w / 2 + (R() - 0.5) * (30 + k * 6), y, width: w, height: 1.2, fill: color, opacity: r1(0.32 - k * 0.015), class: 'tw', style: twinkle(R, 1.2, 1.8) });
      }
      return s;
    },
  },
  rocket: {
    layer: 'street',
    // Launches on a loop only if you pushed code in the last 7 days.
    draw(ctx) {
      const live = ctx.data.last_push_days != null && ctx.data.last_push_days <= 7;
      const body = E('path', { d: 'M856 204v-34q0-14 7-22q7 8 7 22v34z', fill: '#f4f6fb' }) +
        E('path', { d: 'M856 196l-6 10h6zM870 196l6 10h-6z', fill: '#e2484f' }) + E('circle', { cx: 863, cy: 178, r: 3, fill: '#79c0ff' });
      const flame = E('path', { d: 'M858 206q5 16 10 0z', fill: '#ffb347', style: 'transform-box:fill-box;transform-origin:top;' + anim('flame', 0.2, { timing: 'ease-in-out' }) });
      return E('rect', { x: 836, y: 204, width: 40, height: 6, fill: '#c9d1d9' }) + E('line', { x1: 842, y1: 204, x2: 842, y2: 150, stroke: '#8b949e', 'stroke-width': 2 }) +
        (live ? E('g', { style: anim('launch', 6, { timing: 'ease-in' }) }, body + flame) : body);
    },
  },

  // ---------- front ----------
  rain: {
    layer: 'front',
    // Three depths of rain (far drops are short, faint and slow; near drops
    // are long and fast), each streak tilted along the way it falls, plus
    // ripples and little splash crowns where drops hit the street.
    draw(ctx, o = {}) {
      const { color = '#a9b8ff', count = 90, opacity = 0.35, ripples = 28, splash = color } = o;
      const R = ctx.R;
      const SLANT = 0.2; // matches @keyframes rain: 56px sideways per 280px down
      const tiers = [
        { share: 0.45, len: 7, w: 0.6, op: 0.5, dur: [1.1, 0.4] },
        { share: 0.35, len: 12, w: 0.9, op: 1, dur: [0.7, 0.2] },
        { share: 0.2, len: 20, w: 1.3, op: 1.5, dur: [0.45, 0.12] },
      ];
      let s = '';
      for (const t of tiers) {
        let g = '';
        for (let k = 0; k < Math.round(count * t.share); k++) {
          const x = R() * 960, y = -t.len - R() * 30, d = t.dur[0] + R() * t.dur[1];
          g += E('line', { x1: r1(x), y1: r1(y), x2: r1(x - t.len * SLANT), y2: r1(y + t.len), style: anim('rain', d, { delay: R() * d }) });
        }
        s += E('g', { stroke: color, 'stroke-width': t.w, 'stroke-linecap': 'round', opacity: r1(Math.min(1, opacity * t.op)) }, g);
      }
      let rip = '';
      for (let k = 0; k < ripples; k++) {
        const y = 214 + R() * 42, depth = (y - 210) / 50; // nearer the viewer = bigger
        const x = R() * 900, rx = 3 + depth * 6, d = 1.1 + R() * 0.9, delay = R() * d;
        rip += E('ellipse', { cx: r1(x), cy: r1(y), rx: r1(rx), ry: r1(rx * 0.28), class: 'fb', style: anim('ripple', d, { timing: 'ease-out', delay }) });
        rip += E('path', { d: `M${r1(x - 2)} ${r1(y)}l-2-${r1(2 + depth * 3)}M${r1(x)} ${r1(y)}v-${r1(3 + depth * 4)}M${r1(x + 2)} ${r1(y)}l2-${r1(2 + depth * 3)}`, class: 'fb', style: 'transform-origin:bottom;' + anim('crown', d, { timing: 'ease-out', delay }) });
      }
      return s + E('g', { fill: 'none', stroke: splash, 'stroke-width': 0.8, opacity: r1(Math.min(1, opacity * 2)) }, rip);
    },
  },
  snowfall: { layer: 'front', draw: (ctx, o = {}) => falling(ctx, { count: o.count || 110, shape: 'dot', colors: o.colors || ['#ffffff'], name: 'snow', dur: [6, 7] }) },
  petals: { layer: 'front', draw: (ctx, o = {}) => falling(ctx, { count: o.count || 70, shape: 'petal', colors: o.colors || ['#ffc2d6', '#ffe1ec'], name: 'drop', dur: [7, 7] }) },
  leaves: { layer: 'front', draw: (ctx, o = {}) => falling(ctx, { count: o.count || 45, shape: 'leaf', colors: o.colors || ['#e8743b', '#f2a541', '#c8452c'], name: 'drop', dur: [7, 6] }) },
  confetti: { layer: 'front', draw: (ctx, o = {}) => falling(ctx, { count: o.count || 80, shape: 'confetti', colors: o.colors || ['#ff5fa2', '#ffd166', '#7ee787', '#79c0ff', '#b38aff'], name: 'drop', dur: [5, 5] }) },
  fireworks: {
    layer: 'front',
    // when:'release' -> only if you published a release in the last 14 days.
    draw(ctx, o = {}) {
      const { count = 4, colors = ['#ffd166', '#ff7ad9', '#7ee787', '#79c0ff', '#ff9f43'], when = 'always' } = o;
      if (when === 'release' && !(ctx.data.release_days != null && ctx.data.release_days <= 14)) return '';
      const R = ctx.R;
      let s = '';
      for (let i = 0; i < count; i++) {
        const fx = 90 + (i * 720) / Math.max(1, count - 1) + (R() - 0.5) * 60, fy = 46 + R() * 50, c = colors[i % colors.length], rad = 26 + R() * 12;
        let g = '';
        for (let a = 0; a < 16; a++) {
          const an = (a / 16) * Math.PI * 2;
          g += E('line', { x1: fx + Math.cos(an) * 7, y1: fy + Math.sin(an) * 7, x2: fx + Math.cos(an) * rad, y2: fy + Math.sin(an) * rad, stroke: c, 'stroke-width': 2, 'stroke-linecap': 'round' });
        }
        s += E('g', { class: 'fb', style: anim('burst', 3.2, { timing: 'ease-out', delay: (i * 3.2) / count }) }, g);
      }
      return s;
    },
  },
  birds: {
    layer: 'front',
    // One bird per follower, up to 16.
    draw(ctx, o = {}) {
      const { color = '#2c1630', y = 58 } = o;
      const n = clamp(ctx.data.followers || 0, 0, 16), R = ctx.R;
      let s = '';
      for (let k = 0; k < n; k++) {
        const bx = (k % 4) * 14 + R() * 6, by = y + Math.floor(k / 4) * 12 + R() * 8, d = 26 + R() * 10;
        s += E('g', { style: anim('drift', d, { delay: R() * d }) },
          E('path', { d: `M${r1(bx - 6)} ${r1(by)}q6-5 6 0q0-5 6 0`, fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round', class: 'fb', style: anim('flap', 0.5 + R() * 0.3, { timing: 'ease-in-out' }) }));
      }
      return s;
    },
  },
  blimp: {
    layer: 'front',
    // Banner shows config "learning" text, or your top language.
    draw(ctx, o = {}) {
      const d = ctx.data;
      const text = o.text || (d.learning ? `now learning: ${d.learning}` : d.languages?.[0] ? `mostly writing ${d.languages[0].name.toLowerCase()}` : '');
      const { fill = '#ff8fa3', stripe = '#e2627a', ink = '#2b2140', paper = '#fff7d6' } = o;
      let g = '';
      if (text) {
        const w = textW(text) + 16;
        g += E('line', { x1: -62, y1: 66, x2: -32, y2: 66, stroke: ink, 'stroke-width': 1 }) +
          E('rect', { x: -62 - w, y: 57, width: w, height: 18, rx: 3, fill: paper, stroke: ink, 'stroke-width': 1 }) +
          E('text', { x: -62 - w / 2, y: 70, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 11, fill: ink }, esc(text));
      }
      g += E('ellipse', { cx: 0, cy: 66, rx: 32, ry: 12, fill }) + E('path', { d: 'M-24 66h48', stroke: stripe, 'stroke-width': 1.5 }) + E('rect', { x: -8, y: 77, width: 16, height: 6, rx: 2, fill: '#6b4a2c' });
      return E('g', { style: anim('drift', 36, { delay: 12 }) }, g);
    },
  },
  bubbles: {
    layer: 'front',
    // Bubbles = contributions in the last 7 days (max 24).
    draw(ctx, o = {}) {
      const n = Math.min(24, ctx.data.week || 0);
      if (!n) return '';
      const { color = '#d6f6ff' } = o;
      const R = ctx.R, src = landmarks(ctx).length ? landmarks(ctx) : tall(ctx);
      let s = '';
      for (let k = 0; k < n; k++) {
        const b = src[k % src.length], d = 4 + R() * 3;
        s += E('circle', { cx: b.x + b.w / 2 + (R() - 0.5) * 10, cy: b.y - 4, r: 2 + R() * 2, fill: 'none', stroke: color, 'stroke-width': 1, style: anim('rise', d, { timing: 'ease-in', delay: R() * d }) });
      }
      return s;
    },
  },
  fish: {
    layer: 'front',
    draw(ctx) {
      const R = ctx.R;
      return [['carL', 18, 120, '#ffb347', 1], ['carR', 24, 80, '#ff7b72', 0.8], ['carL', 30, 150, '#a5d6ff', 0.7]].map((f) => {
        const d = f[0] === 'carL' ? 1 : -1, k = f[4];
        return E('g', { style: anim(f[0], f[1], { delay: R() * f[1] }) },
          E('ellipse', { cx: 0, cy: f[2], rx: 9 * k, ry: 4.5 * k, fill: f[3] }) +
          E('path', { d: `M${r1(-d * 8 * k)} ${f[2]}l${r1(-d * 6 * k)} ${r1(-4 * k)}v${r1(8 * k)}z`, fill: f[3] }) +
          E('circle', { cx: d * 4 * k, cy: f[2] - 1, r: 1.2, fill: '#021b2e' }));
      }).join('');
    },
  },
  submarine: {
    layer: 'front',
    // One submarine per open pull request on your repos (max 3).
    draw(ctx) {
      const n = Math.min(3, ctx.data.prs || 0);
      let s = '';
      for (let k = 0; k < n; k++) {
        const y = 186 - k * 34;
        s += E('g', { style: anim(k % 2 ? 'carR' : 'carL', 22 + k * 6, { delay: k * 7 }) },
          E('ellipse', { cx: 10, cy: y, rx: 22, ry: 8, fill: '#ffd33d' }) + E('rect', { x: 4, y: y - 12, width: 12, height: 7, rx: 2, fill: '#ffd33d' }) +
          E('circle', { cx: 18, cy: y, r: 3, fill: '#7fdbff', stroke: '#b08800' }) + E('circle', { cx: 6, cy: y, r: 3, fill: '#7fdbff', stroke: '#b08800' }));
      }
      return s;
    },
  },
  bats: {
    layer: 'front',
    draw(ctx, o = {}) {
      const { color = '#0b0612', count = 7 } = o;
      const R = ctx.R;
      let s = '';
      for (let k = 0; k < count; k++) {
        const y = 40 + R() * 90, d = 14 + R() * 10;
        s += E('g', { style: anim(k % 2 ? 'carR' : 'carL', d, { delay: R() * d }) },
          E('path', { d: `M0 ${r1(y)}q-5-6-11-2q4 1 3 5q4-3 8-3zM0 ${r1(y)}q5-6 11-2q-4 1-3 5q-4-3-8-3z`, fill: color, class: 'fb', style: anim('flap', 0.35, { timing: 'ease-in-out' }) }) +
          E('circle', { cx: 0, cy: y, r: 2.2, fill: color }));
      }
      return s;
    },
  },
  powderBursts: {
    layer: 'front',
    draw(ctx, o = {}) {
      const { colors = ['#ff5fa2', '#ffb000', '#2ec4b6', '#7b5cff', '#3ad16b'] } = o;
      const R = ctx.R;
      let s = '';
      for (let i = 0; i < 6; i++) {
        const cx = 80 + i * 150 + R() * 40, cy = 60 + R() * 80, c = colors[i % colors.length];
        let g = '';
        for (let k = 0; k < 14; k++) g += E('circle', { cx: cx + (R() - 0.5) * 50, cy: cy + (R() - 0.5) * 34, r: 3 + R() * 7, fill: c, opacity: 0.45 });
        s += E('g', { class: 'fb', style: anim('burst', 4, { timing: 'ease-out', delay: i * 0.66 }) }, g);
      }
      return s;
    },
  },
  fog: {
    layer: 'front',
    draw(ctx, o = {}) {
      const { color = '#d9d9e0', opacity = 0.07 } = o;
      return [150, 182, 200].map((y, i) => E('rect', { x: -300, y, width: 1500, height: 16 + i * 6, rx: 10, fill: color, opacity, style: anim('fogm', 30 + i * 10, { timing: 'ease-in-out', dir: 'alternate', delay: i * 7 }) })).join('');
    },
  },

  // ---------- ui ----------
  greeting: {
    layer: 'ui',
    draw(ctx, o = {}) {
      const { text = `hello ${ctx.data.year}`, color = '#ffe8a3' } = o;
      return E('text', { x: 450, y: 58, 'text-anchor': 'middle', 'font-family': SANS, 'font-size': 26, 'font-weight': 600, fill: color, class: 'tw', style: 'animation-duration:4s' }, esc(text));
    },
  },
  langLegend: {
    layer: 'ui',
    draw(ctx, o = {}) {
      const { fg = '#ffe1fb', bg = '#1a0b3b', y = 46 } = o;
      const langs = (ctx.data.languages || []).slice(0, 4);
      if (!langs.length) return '';
      const w = Math.max(...langs.map((l) => textW(l.name))) + 32, x = 900 - w - 10;
      return E('rect', { x, y: y - 14, width: w, height: langs.length * 16 + 10, rx: 5, fill: bg, opacity: 0.85 }) +
        langs.map((l, i) => E('rect', { x: x + 8, y: y + i * 16 - 8, width: 9, height: 9, rx: 2, fill: l.color || '#8b949e' }) +
          E('text', { x: x + 22, y: y + i * 16, 'font-family': MONO, 'font-size': 11, fill: fg }, esc(l.name.toLowerCase()))).join('');
    },
  },
  contribLegend: {
    layer: 'ui',
    draw(ctx, o = {}) {
      const { fg = '#57606a', x = 714, y = 44 } = o;
      const L = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
      return E('text', { x: x - 34, y: y + 9, 'font-family': MONO, 'font-size': 11, fill: fg }, 'less') +
        L.map((c, i) => E('rect', { x: x + i * 13, y, width: 10, height: 10, rx: 2, fill: c })).join('') +
        E('text', { x: x + 68, y: y + 9, 'font-family': MONO, 'font-size': 11, fill: fg }, 'more');
    },
  },
};

// ---------- grounds ----------
export const GROUNDS = {
  bands(ctx, { colors }) {
    const h = 50 / colors.length;
    return colors.map((c, i) => E('rect', { x: 0, y: 210 + i * h, width: 900, height: h + 1, fill: c })).join('');
  },
  road(ctx, { base, road, edge, dots }) {
    let s = E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base });
    if (edge) s += E('rect', { x: 0, y: 210, width: 900, height: 6, fill: edge });
    if (road) s += E('rect', { x: 0, y: 221, width: 900, height: 28, fill: road });
    if (dots) for (let k = 0; k < 30; k++) s += E('circle', { cx: k * 31 + 8, cy: 255, r: 3, fill: dots });
    return s;
  },
  grid(ctx, { base = '#150628', h = '#ff4fd8', v = '#36e2ff' }) {
    let s = E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base });
    let g = '';
    for (let y = 210; y < 274; y += 12) g += E('line', { x1: 0, y1: y, x2: 900, y2: y, stroke: h, 'stroke-width': 1, opacity: 0.6 });
    s += E('g', { style: anim('grid', 1) }, g);
    for (let k = -12; k <= 12; k++) s += E('line', { x1: 450 + k * 14, y1: 210, x2: 450 + k * 90, y2: 260, stroke: v, 'stroke-width': 1, opacity: 0.5 });
    return s;
  },
  // Wet street: buildings and lit windows mirror into the ground.
  reflect(ctx, { base = '#0b0e22', opacity = 0.5, shimmer = false }) {
    let s = E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base });
    const wob = (i) => (shimmer ? { style: anim('wob', 1.6 + (i % 5) * 0.35, { timing: 'ease-in-out', dir: 'alternate', delay: (i % 7) * 0.3 }) } : {});
    for (const b of ctx.city) s += E('rect', { x: b.x, y: 211, width: b.w, height: Math.min(48, b.h * 0.32), fill: b.fill, opacity });
    ctx.windows.forEach((w, i) => {
      if (i % 2) return;
      const y = 211 + (210 - w.y) * 0.32;
      if (y < 257) s += E('rect', { x: w.x, y, width: w.s, height: 2.5, fill: w.c, opacity: 0.4, ...wob(i) });
    });
    return s;
  },
  sand(ctx, { base = '#c2a36b', edge = '#a88a55' }) {
    return E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base }) + E('rect', { x: 0, y: 210, width: 900, height: 6, fill: edge });
  },
  dunes(ctx, { base = '#e9b872', dune = '#f3c98a', shade = '#d9a25f' }) {
    let s = E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base });
    s += E('path', { d: 'M0 226Q120 206 240 226T480 226T720 226T960 226V260H0z', fill: dune });
    s += E('path', { d: 'M0 246Q90 232 180 246T360 246T540 246T720 246T900 246V260H0z', fill: shade });
    return s;
  },
  lunar(ctx, { base = '#7d828c', crater = '#646973', rim = '#9aa0aa' }) {
    let s = E('rect', { x: 0, y: 210, width: 900, height: 50, fill: base });
    const R = ctx.R;
    for (let k = 0; k < 14; k++) {
      const cx = R() * 900, cy = 222 + R() * 32, rx = 8 + R() * 16;
      s += E('ellipse', { cx, cy, rx, ry: rx * 0.3, fill: crater }) + E('path', { d: `M${r1(cx - rx)} ${r1(cy)}a${r1(rx)} ${r1(rx * 0.3)} 0 0 0 ${r1(rx * 2)} 0`, fill: 'none', stroke: rim, 'stroke-width': 1 });
    }
    return s;
  },
};
