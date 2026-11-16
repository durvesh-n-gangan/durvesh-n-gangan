#!/usr/bin/env node
// Renders every theme against three very different accounts and checks the
// output. Run: node gitworld/test.mjs
import { THEMES } from './src/themes.mjs';
import { render } from './src/render.mjs';
import { derive } from './src/data.mjs';
import { demoRaw } from './src/demo.mjs';
import { checkSvg } from './src/check.mjs';
import { selectThemes } from './src/select.mjs';

const today = '2026-11-16';
const days = (n, f) => Array.from({ length: n }, (_, k) => {
  const date = new Date(Date.parse(today) - (n - 1 - k) * 86400000).toISOString().slice(0, 10);
  const count = f(k);
  return { date, count, level: count ? Math.min(4, 1 + (count % 4)) : 0 };
});

const fixtures = {
  demo: demoRaw(today),
  // Brand-new account: nothing at all.
  empty: { username: 'nullbyte', followers: 0, contributions: 0, calendar: [], repos: [], recent_commits: [] },
  // Busy account with awkward names.
  heavy: {
    username: 'a&b<c>"d\'',
    followers: 9000,
    contributions: 5000,
    calendar: days(365, (k) => (k * 7) % 23),
    repos: Array.from({ length: 100 }, (_, i) => ({
      name: i % 3 ? `repo-${i}-with-a-very-long-name-that-keeps-going` : `<&> émoji 🚀 ${i}`,
      fork: i % 5 === 0, stars: i * 13, size_kb: i * 900, pushed_at: '2026-11-15T10:00:00Z',
      language: i % 4 ? 'TypeScript' : null, language_color: i % 4 ? '#3178c6' : null,
      open_issues: 3, open_prs: 2, last_release_at: '2026-11-10T00:00:00Z', last_starred_at: '2026-11-15T00:00:00Z',
    })),
    recent_commits: ['fix: handle <script> & "quotes"', 'feat: 🚀 launch ünïcödé support\n\nlong body here', 'x'.repeat(300)],
  },
};

let fails = 0;
for (const [name, raw] of Object.entries(fixtures)) {
  const data = derive(raw, { todayISO: today });
  let ok = 0;
  for (const t of THEMES) {
    try { checkSvg(`${name}/${t.name}`, render(t, data)); ok++; } catch (e) { fails++; console.error('FAIL', e.message); }
  }
  console.log(`${name}: ${ok}/${THEMES.length} themes ok`);
}

const cfg = { theme: 'classic-blue', light_theme: 'github-light', auto: { festivals: true, seasons: true } };
const expect = { '2026-11-08': 'diwali', '2026-03-04': 'holi', '2026-12-31': 'new-year', '2026-10-28': 'halloween', '2026-12-15': 'winter-night', '2026-04-01': 'sakura-dusk', '2026-10-05': 'autumn', '2026-07-01': 'classic-blue' };
for (const [d, want] of Object.entries(expect)) {
  const got = selectThemes(cfg, d).dark;
  if (got !== want) { fails++; console.error(`FAIL theme on ${d}: got ${got}, want ${want}`); }
}
console.log(`auto theme dates checked: ${Object.keys(expect).length}`);
if (fails) { console.error(`${fails} failure(s)`); process.exit(1); }
console.log('all good');
