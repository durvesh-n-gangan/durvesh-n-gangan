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

// A repo keeps its building when another repo is hidden or deleted, and the
// billboard stands on the tower of the repo it shows commits from.
{
  const { layoutCity } = await import('./src/render.mjs');
  const repo = (name, size_kb) => ({ name, fork: false, stars: 0, size_kb, pushed_at: '2026-11-15T00:00:00Z' });
  const all = ['NL2SQL', 'AWS_Route53_Clone', 'AnimeRecommender', 'Floating-Timer', 'Everyday-Object-Catalog'].map((n, i) => repo(n, 500 + i * 400));
  const where = (repos) => Object.fromEntries(layoutCity({ username: 'durvesh-n-gangan', repos }).filter((b) => b.repo).map((b) => [b.repo.name, b.x]));
  const before = where(all), after = where(all.filter((r) => r.name !== 'AnimeRecommender'));
  for (const [n, x] of Object.entries(after)) if (before[n] !== x) { fails++; console.error(`FAIL ${n} moved from x=${before[n]} to x=${x}`); }
  const data = derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [], repos: all,
    recent_commits: [{ repo: 'Floating-Timer', msg: 'License' }, { repo: 'AWS_Route53_Clone', msg: 'chore: tidy' }, { repo: 'Floating-Timer', msg: 'fix: drag' }] }, { todayISO: today });
  const svg = render(THEMES.find((t) => t.name === 'classic-blue'), data);
  if (!svg.includes('License   ·   fix: drag') || svg.includes('chore: tidy')) { fails++; console.error('FAIL billboard should show only Floating-Timer commits'); }
  console.log('stable towers and billboard checked');

  // Antennas only on repos with open issues, and the tag names the issue.
  const quiet = render(THEMES.find((t) => t.name === 'classic-blue'), data);
  if (quiet.includes('tw beacon')) { fails++; console.error('FAIL antenna light shown with no open issues'); }
  const withIssue = derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [],
    repos: all.map((r) => (r.name === 'NL2SQL' ? { ...r, open_issues: 1, issue_titles: ['Query fails on joins'] } : r)), recent_commits: [] }, { todayISO: today });
  for (const t of THEMES) {
    const svg = render(t, withIssue);
    if (!svg.includes('issue: Query fails on joins')) { fails++; console.error(`FAIL ${t.name}: issue title missing`); }
    if ((svg.match(/tw beacon/g) || []).length !== 1) { fails++; console.error(`FAIL ${t.name}: expected exactly one blinking light`); }
  }
  console.log('issue antennas and tags checked in every theme');
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
