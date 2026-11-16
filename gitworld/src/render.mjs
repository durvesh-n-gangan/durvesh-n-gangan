// Scene renderer: turns (theme, data) into one standalone animated SVG.
import { E, anim, pick, rng, hash, textW, twinkle, clamp, esc, r1 } from './svg.mjs';
import { FEATURES, GROUNDS } from './features.mjs';

export const W = 900, H = 260, GY = 210;

const CSS = `
.fb{transform-box:fill-box;transform-origin:center}
.tw{animation:tw 3s ease-in-out infinite}
@keyframes tw{50%{opacity:.2}}
@keyframes neon{0%,46%,54%,100%{opacity:1}48%{opacity:.35}50%{opacity:.9}52%{opacity:.4}}
@keyframes carL{from{transform:translateX(-80px)}to{transform:translateX(980px)}}
@keyframes carR{from{transform:translateX(980px)}to{transform:translateX(-80px)}}
@keyframes leg{from{transform:rotate(-25deg)}to{transform:rotate(25deg)}}
@keyframes bob{50%{transform:translateY(-3px)}}
@keyframes drift{from{transform:translateX(-260px)}to{transform:translateX(1160px)}}
@keyframes rain{from{transform:translate(0,0)}to{transform:translate(-56px,280px)}}
@keyframes ripple{0%{transform:scale(.15);opacity:0}8%{opacity:1}100%{transform:scale(1.5);opacity:0}}
@keyframes crown{0%{transform:scaleY(.2);opacity:0}6%{opacity:1}22%{transform:scaleY(1);opacity:0}100%{opacity:0}}
@keyframes flash{0%,86%,100%{opacity:0}87%{opacity:.32}88%{opacity:.04}89.5%{opacity:.24}92%{opacity:0}}
@keyframes wob{from{transform:translateX(-1.5px)}to{transform:translateX(1.5px)}}
@keyframes snow{from{transform:translate(0,-10px)}to{transform:translate(20px,270px)}}
@keyframes drop{from{transform:translate(0,-10px) rotate(0deg)}to{transform:translate(-70px,270px) rotate(540deg)}}
@keyframes crain{from{transform:translateY(0)}to{transform:translateY(420px)}}
@keyframes rise{from{transform:translateY(0);opacity:.9}to{transform:translateY(-220px);opacity:0}}
@keyframes burst{0%{transform:scale(.1);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes flick{50%{transform:scaleY(.7);opacity:.75}}
@keyframes shoot{0%,85%{transform:translate(0,0);opacity:0}87%{opacity:1}100%{transform:translate(-240px,100px);opacity:0}}
@keyframes grid{to{transform:translateY(12px)}}
@keyframes puff{0%{transform:translate(0,0) scale(.5);opacity:.8}100%{transform:translate(-14px,-30px) scale(1.6);opacity:0}}
@keyframes coin{0%,70%{transform:translateY(0);opacity:0}75%{opacity:1}100%{transform:translateY(-22px);opacity:0}}
@keyframes launch{0%,45%{transform:translateY(0)}100%{transform:translateY(-280px)}}
@keyframes flame{50%{transform:scaleY(1.5)}}
@keyframes sway{50%{transform:rotate(7deg)}}
@keyframes ray{50%{opacity:.02}}
@keyframes flap{50%{transform:scaleY(.35)}}
@keyframes sweep{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
@keyframes auro{from{transform:translateX(-20px) skewX(6deg)}to{transform:translateX(30px) skewX(-8deg)}}
@keyframes fogm{from{transform:translateX(-120px)}to{transform:translateX(160px)}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

const DEFAULTS = {
  mode: 'dark',
  stars: null,
  dwin: null,
  lit: 0.4,
  roof: null,
  smallRoof: 'tri',
  domeColor: null,
  topDome: null,
  antenna: '#8b949e',
  beacon: '#ff5c5c',
  windowSize: 3.5,
  windowGap: 7,
  windowMode: 'palette',
  crisp: false,
  road: true,
  lane: '#ffffff',
  cars: ['#ff6b6b', '#ffd166', '#7ee787'],
  carStyle: 'car',
  hero: '#f0f6fc',
  heroStyle: 'walker',
  monster: '#da3633',
  monsterStyle: 'blob',
  features: [],
  left: "{user}'s gitworld · {contributions} contributions",
  right: '{streak}d streak',
};
const REQUIRED = ['name', 'label', 'sky', 'far', 'buildings', 'win', 'ground', 'pill'];

export function resolveTheme(theme) {
  const t = { ...DEFAULTS, ...theme };
  const missing = REQUIRED.filter((k) => t[k] === undefined || t[k] === null);
  if (missing.length) throw new Error(`theme "${t.name}" is missing: ${missing.join(', ')}`);
  if (!Array.isArray(t.sky) || !t.sky.length) throw new Error(`theme "${t.name}": sky must be a non-empty array`);
  if (!Array.isArray(t.win) || !t.win.length) throw new Error(`theme "${t.name}": win must be a non-empty array`);
  if (!GROUNDS[t.ground.type]) throw new Error(`theme "${t.name}": unknown ground type "${t.ground.type}"`);
  for (const f of t.features) {
    const name = Array.isArray(f) ? f[0] : f;
    if (!FEATURES[name]) throw new Error(`theme "${t.name}": unknown feature "${name}"`);
  }
  return t;
}

const repoScore = (r) => Math.log2(1 + (r.stars || 0) * 4 + (r.commits || 0) + (r.size_kb || 0) / 200);

// One tower per repository you own (public with a name sign, private and
// your profile repo without), and nothing else on the street, so counting
// the towers gives your repository count. Towers keep their left-to-right
// order (sorted by a hash of the repo), and a tower's height comes from that
// repo's own size and stars.
export const MAX_TOWERS = 60; // more than this can't fit in 900px
export function layoutCity(data) {
  const towers = [
    ...(data.repos || []).map((r) => ({ key: 'pub:' + r.name, repo: r })),
    ...(data.private_towers || []).map((p) => ({ key: 'priv:' + p.id, repo: { name: p.id, private: true, size_kb: p.size_kb, stars: p.stars, open_issues: p.open_issues, days_since_push: p.days_since_push } })),
  ];
  const shown = towers.sort((a, b) => repoScore(b.repo) - repoScore(a.repo)).slice(0, MAX_TOWERS)
    .sort((a, b) => hash('tower:' + a.key) - hash('tower:' + b.key));
  if (!shown.length) return [];
  // Each tower's width comes from its own hash, so adding or removing a repo
  // only nudges the spacing and never reorders the skyline.
  const frac = (key) => (hash(key + ':' + data.username) % 1000) / 1000;
  const gap = shown.length > 40 ? 2 : 4, avail = 876 - gap * (shown.length - 1);
  const weights = shown.map((it) => 0.8 + frac('w:' + it.key) * 0.4);
  const unit = Math.min(avail / weights.reduce((s, w) => s + w, 0), 80);
  const used = weights.reduce((s, w) => s + w * unit, 0) + gap * (shown.length - 1);
  let x = 12 + (876 - used) / 2;
  const slots = shown.map((it, i) => {
    const w = weights[i] * unit;
    const s = { x, w, h: 70 + 70 * clamp(repoScore(it.repo) / 10, 0, 1), small: false, repo: it.repo, seed: frac('s:' + it.key) };
    x += w + gap;
    return s;
  });
  for (const s of slots) s.y = GY - s.h;
  return slots;
}

function fmt(tpl, d) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = {
      user: d.username, contributions: d.contributions, streak: d.streak, repos: d.total_repos ?? d.repo_count, stars: d.stars_total,
      followers: d.followers, issues: d.issues, prs: d.prs, week: d.week, lang: d.languages?.[0]?.name?.toLowerCase() ?? 'code',
      year: d.year, month: d.month, last: d.days_since_last == null ? '?' : d.days_since_last === 0 ? 'today' : `${d.days_since_last}d ago`,
    }[k];
    return v === undefined || v === null ? '?' : String(v);
  });
}

function pill(x, y, text, bg, fg) {
  const w = textW(text) + 16;
  return { w, svg: E('rect', { x, y, width: w, height: 18, rx: 5, fill: bg, opacity: 0.88 }) + E('text', { x: x + 8, y: y + 13, 'font-family': 'monospace', 'font-size': 11, fill: fg }, esc(text)) };
}

function drawHero(t, ctx) {
  if (!t.hero) return '';
  const c = t.hero;
  let body = E('circle', { cx: 0, cy: 204, r: 3.5, fill: c }) + E('rect', { x: -2.5, y: 207, width: 5, height: 7, fill: c });
  if (t.heroStyle === 'umbrella') body += E('path', { d: 'M-9 202q9-12 18 0z', fill: '#ff4fd8' }) + E('line', { x1: 0, y1: 202, x2: 0, y2: 210, stroke: '#ff4fd8', 'stroke-width': 1 });
  if (t.heroStyle === 'astronaut') body = E('circle', { cx: 0, cy: 203, r: 4.5, fill: c }) + E('rect', { x: -2.5, y: 201.5, width: 5, height: 3, rx: 1.5, fill: '#79c0ff' }) + E('rect', { x: -3.5, y: 207, width: 7, height: 7, rx: 2, fill: c }) + E('rect', { x: -6, y: 207, width: 3, height: 6, fill: '#c9d1d9' });
  const legs = [0, 1].map((k) => E('line', { x1: 0, y1: 214, x2: 0, y2: 220, stroke: c, 'stroke-width': 2, style: `transform-box:view-box;transform-origin:0px 214px;animation:leg .45s ease-in-out infinite alternate${k ? '-reverse' : ''}` })).join('');
  return E('g', { style: anim('carL', 40, { delay: 8 }) }, E('g', { style: anim('bob', 0.45, { timing: 'ease-in-out' }) }, body) + legs);
}

function drawCars(t, ctx) {
  if (!t.cars) return '';
  const n = ctx.data.week > 0 ? clamp(1 + Math.floor(ctx.data.week / 5), 1, 3) : 1;
  const lanes = [['carL', 9, 0, 226], ['carR', 12, 5, 242], ['carL', 15, 9, 226]].slice(0, n);
  return lanes.map((c, k) => {
    const col = t.cars[k % t.cars.length];
    const fwd = c[0] === 'carL';
    let g;
    if (t.carStyle === 'rover') {
      g = E('rect', { x: 0, y: c[3] - 9, width: 20, height: 7, rx: 2, fill: col }) + E('line', { x1: 14, y1: c[3] - 9, x2: 16, y2: c[3] - 16, stroke: col, 'stroke-width': 1.5 }) +
        E('circle', { cx: 16, cy: c[3] - 17, r: 2, fill: '#79c0ff' }) + [3, 10, 17].map((wx) => E('circle', { cx: wx, cy: c[3], r: 2.6, fill: '#2b2f36' })).join('');
    } else {
      g = E('rect', { x: 0, y: c[3] - 6, width: 20, height: 7, rx: 2, fill: col }) + E('rect', { x: 5, y: c[3] - 10, width: 10, height: 5, rx: 1.5, fill: col }) +
        E('rect', { x: fwd ? 19 : -2, y: c[3] - 5, width: 3, height: 2, fill: '#fff6c2' });
    }
    return E('g', { style: anim(c[0], c[1], { delay: c[2] }) }, g);
  }).join('');
}

// Monsters = your open issues (max 6). No open issues, no monsters.
function drawMonsters(t, ctx) {
  if (!t.monster) return '';
  const n = Math.min(6, ctx.data.issues || 0);
  const R = rng(hash('mon:' + ctx.data.username));
  let s = '';
  for (let m = 0; m < n; m++) {
    const mx = r1(60 + m * 140 + R() * 60), c = t.monster;
    let body;
    if (t.monsterStyle === 'ghost') body = E('path', { d: `M${mx - 6} 220v-8a6 6 0 0 1 12 0v8l-2-2-2 2-2-2-2 2-2-2z`, fill: c });
    else body = E('path', { d: `M${mx - 6} 218q0-12 6-12t6 12z`, fill: c });
    s += E('g', { style: anim('bob', 1 + R(), { timing: 'ease-in-out' }) }, body + E('circle', { cx: mx - 2, cy: 212, r: 1.4, fill: t.monsterStyle === 'ghost' ? '#1a1030' : '#ffffff' }) + E('circle', { cx: mx + 2, cy: 212, r: 1.4, fill: t.monsterStyle === 'ghost' ? '#1a1030' : '#ffffff' }));
  }
  return s;
}

export function render(themeIn, data) {
  const t = resolveTheme(themeIn);
  const R = rng(hash(data.username + ':' + t.name));
  const city = layoutCity(data).map((b) => ({ ...b }));
  const ctx = { t, R, data, city, windows: [], defs: [], css: [], skyAt: (y) => t.sky[clamp(Math.floor((y / GY) * t.sky.length), 0, t.sky.length - 1)] };
  const feats = t.features.map((f) => (Array.isArray(f) ? { name: f[0], opts: f[1] || {} } : { name: f, opts: {} }));
  const layer = (name) => feats.filter((f) => FEATURES[f.name].layer === name).map((f) => FEATURES[f.name].draw(ctx, f.opts)).join('');
  const p = [];

  // sky
  const n = t.sky.length;
  t.sky.forEach((c, i) => p.push(E('rect', { x: 0, y: (i * GY) / n, width: W, height: GY / n + 1, fill: c })));
  if (t.stars) for (let i = 0; i < 60; i++) p.push(E('circle', { cx: R() * W, cy: R() * 150, r: R() < 0.15 ? 1.5 : 0.8, fill: t.stars, class: 'tw', style: twinkle(R, 2, 3) }));
  p.push(layer('sky'));

  // far skyline (same shape in every theme)
  const FR = rng(hash('far:' + data.username));
  for (let fx = 0; fx < W;) { const w = 18 + FR() * 30, h = 30 + FR() * 70; p.push(E('rect', { x: fx, y: GY - h, width: w, height: h, fill: t.far })); fx += w; }
  p.push(layer('back'));

  // buildings + windows
  const contrib = (data.calendar || []).map((d) => d.level).slice(-400);
  let ci = 0;
  // "Lights on where you're working": each building's lights fill its floors
  // from the ground up, as high as that repo is recent. Pushed today: lit to
  // the top. A week ago: about two thirds. A month: about half. Months: only
  // the lower floors. Over a year: a night guard's light or two. A repo pushed
  // in the last day also has flickering top-floor lights (working late).
  // Within the lit floors, the theme's own density keeps its character.
  const fill = (days) => (days == null ? 0.35 : clamp(1 - (Math.log10(1 + days) / Math.log10(401)) * 0.95, 0.05, 1));
  const density = clamp(t.lit * 1.9, 0.35, 0.95);
  for (const b of city) {
    b.fill = t.buildings === 'language' ? (b.repo?.language_color || pick(R, t.fillers)) : pick(R, t.buildings);
    p.push(E('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: b.fill }));
    if (!b.small) {
      const ws = t.windowSize, step = ws + 4.5;
      const days = b.repo?.days_since_push, level = fill(days), late = days != null && days <= 1;
      for (let wy = b.y + 8; wy < GY - 6; wy += step) {
        const floor = (GY - wy) / b.h; // 0 at the street, 1 at the roof
        for (let wx = b.x + 4; wx < b.x + b.w - ws - 2; wx += t.windowGap) {
          let c = null;
          if (t.windowMode === 'contrib') {
            const lvl = contrib.length ? contrib[ci++ % contrib.length] : 0;
            c = lvl > 0 ? t.win[clamp(lvl - 1, 0, t.win.length - 1)] : t.dwin;
            p.push(E('rect', { x: wx, y: wy, width: ws, height: ws * 1.25, fill: c }));
            if (lvl > 0) ctx.windows.push({ x: wx, y: wy, s: ws, c });
            continue;
          }
          const on = floor <= level + (R() - 0.5) * 0.18 && R() < density;
          if (on) {
            c = pick(R, t.win);
            const flick = late && floor > 0.7 ? R() < 0.6 : R() < 0.06;
            p.push(E('rect', { x: wx, y: wy, width: ws, height: ws * 1.25, fill: c, class: flick ? 'tw' : undefined, style: flick ? twinkle(R, late ? 1.2 : 3, late ? 2 : 6) : undefined }));
            ctx.windows.push({ x: wx, y: wy, s: ws, c });
          } else if (t.dwin) p.push(E('rect', { x: wx, y: wy, width: ws, height: ws * 1.25, fill: t.dwin }));
        }
      }
      if (t.topDome && R() < 0.4) p.push(E('path', { d: `M${r1(b.x + 2)} ${r1(b.y)}a${r1(b.w / 2 - 2)} ${r1(b.w / 2 - 2)} 0 0 1 ${r1(b.w - 4)} 0z`, fill: t.topDome, opacity: 0.4 }));
      // An antenna with a blinking light (in the theme's beacon colour) means
      // exactly one thing: this repo has open issues. More issues, faster
      // blink: 1 issue every 1.6s, down to 0.4s at 6 or more. No issues, no
      // antenna.
      const issues = b.repo?.open_issues || 0;
      if (issues > 0) {
        const cx = b.x + b.w / 2, speed = r1(Math.max(0.4, 1.6 - (Math.min(issues, 6) - 1) * 0.24));
        p.push(E('line', { x1: cx, y1: b.y, x2: cx, y2: b.y - 14, stroke: t.antenna, 'stroke-width': 1.5 }) +
          E('circle', { cx, cy: b.y - 15, r: 2.4, fill: t.beacon, class: 'tw beacon', style: `animation-duration:${speed}s` }));
      }
    } else {
      const door = t.windowMode === 'contrib' ? t.win[1] : t.win[0];
      if (t.smallRoof === 'dome') p.push(E('path', { d: `M${r1(b.x)} ${r1(b.y)}a${r1(b.w / 2)} ${r1(b.w / 2)} 0 0 1 ${r1(b.w)} 0z`, fill: t.domeColor || b.fill, opacity: t.domeColor ? 0.6 : 1 }));
      else if (t.smallRoof === 'tri') p.push(E('polygon', { points: `${r1(b.x - 2)},${r1(b.y)} ${r1(b.x + b.w / 2)},${r1(b.y - 10)} ${r1(b.x + b.w + 2)},${r1(b.y)}`, fill: t.roof || b.fill }));
      p.push(E('rect', { x: b.x + b.w / 2 - 3, y: b.y + b.h - 9, width: 6, height: 9, fill: door }));
    }
  }
  p.push(layer('mid'));

  // ground, street, traffic
  p.push(GROUNDS[t.ground.type](ctx, t.ground));
  p.push(layer('street'));
  if (t.road) {
    if (t.lane) p.push(E('path', { d: 'M0 236h900', stroke: t.lane, 'stroke-width': 1.5, 'stroke-dasharray': '14 12', opacity: 0.4 }));
    p.push(drawCars(t, ctx), drawHero(t, ctx), drawMonsters(t, ctx));
  }
  p.push(layer('front'));

  // labels
  const L = pill(10, 8, fmt(t.left, data), t.pill.bg, t.pill.fg);
  const rt = fmt(t.right, data);
  const Rp = pill(W - (textW(rt) + 16) - 10, 8, rt, t.pill.bg, t.pill.fg);
  p.push(L.svg, Rp.svg, layer('ui'));

  const title = `${data.username}'s GitWorld (${t.label})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}"${t.crisp ? ' shape-rendering="crispEdges"' : ''}>` +
    `<title>${esc(title)}</title><style>${CSS}${ctx.css.join('')}</style>` +
    (ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '') +
    E('clipPath', { id: 'frame' }, E('rect', { width: W, height: H, rx: 12 })) +
    `<g clip-path="url(#frame)">${p.join('')}</g></svg>`;
}
