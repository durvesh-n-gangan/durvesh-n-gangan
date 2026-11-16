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
  // One tower per repo (counting towers = counting repos), and hiding a
  // repo never reorders the others.
  const order = (repos, priv = []) => layoutCity({ username: 'durvesh-n-gangan', repos, private_towers: priv }).filter((b) => !b.small).map((b) => b.repo.name);
  const before = order(all), after = order(all.filter((r) => r.name !== 'AnimeRecommender'));
  if (before.length !== all.length) { fails++; console.error(`FAIL expected ${all.length} towers, got ${before.length}`); }
  if (after.join() !== before.filter((n) => n !== 'AnimeRecommender').join()) { fails++; console.error(`FAIL towers reordered: ${before} -> ${after}`); }
  const fifteen = order([...all, repo('durvesh-n-gangan', 50)], Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, size_kb: 100 * i, stars: 0, open_issues: 0 })));
  if (fifteen.length !== 15) { fails++; console.error(`FAIL 6 public + 9 private should give 15 towers, got ${fifteen.length}`); }
  const data = derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [], repos: all,
    recent_commits: [{ repo: 'Floating-Timer', msg: 'License' }, { repo: 'AWS_Route53_Clone', msg: 'chore: tidy' }, { repo: 'Floating-Timer', msg: 'fix: drag' }] }, { todayISO: today });
  const svg = render(THEMES.find((t) => t.name === 'classic-blue'), data);
  if (!svg.includes('License   ·   fix: drag') || svg.includes('chore: tidy')) { fails++; console.error('FAIL billboard should show only Floating-Timer commits'); }
  console.log('stable towers and billboard checked');

  // Antennas only on repos with open issues; more issues blink faster; no
  // issue text anywhere.
  const quiet = render(THEMES.find((t) => t.name === 'classic-blue'), data);
  if (quiet.includes('tw beacon')) { fails++; console.error('FAIL antenna shown with no open issues'); }
  const withIssues = derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [],
    repos: all.map((r) => (r.name === 'NL2SQL' ? { ...r, open_issues: 1 } : r.name === 'Floating-Timer' ? { ...r, open_issues: 5 } : r)), recent_commits: [] }, { todayISO: today });
  for (const t of THEMES) {
    const svg = render(t, withIssues);
    const speeds = [...svg.matchAll(/tw beacon" style="animation-duration:([\d.]+)s/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    if (speeds.length !== 2 || !(speeds[0] < speeds[1])) { fails++; console.error(`FAIL ${t.name}: expected 2 antennas, faster for more issues, got ${speeds}`); }
    if (/open issue|issues?:/.test(svg.replace(/<title>[\s\S]*?<\/title>/, '').replace(/ghosts = open issues/, ''))) { fails++; console.error(`FAIL ${t.name}: issue text still drawn`); }
  }
  console.log('issue antennas and blink speed checked in every theme');
}

// Private repos: unnamed towers with issue antennas; their names never
// leave the fetch step and never reach the picture.
{
  const { fetchRaw } = await import('./src/data.mjs');
  const realFetch = globalThis.fetch;
  const ok = (b) => ({ ok: true, json: async () => b });
  const pub = (name, issues) => ({ name, isFork: false, stargazerCount: 0, diskUsage: 800, pushedAt: '2026-11-15T00:00:00Z', primaryLanguage: null, issues: { totalCount: issues }, pullRequests: { totalCount: 0 }, releases: { nodes: [] } });
  globalThis.fetch = async (url, o) => {
    if (url.endsWith('/graphql')) {
      const q = JSON.parse(o.body).query;
      if (q.includes('viewer')) return ok({ data: { viewer: { login: 'durvesh-n-gangan', repositories: { nodes: [
        { name: 'SECRET-diary', isFork: false, diskUsage: 5000, stargazerCount: 0, issues: { totalCount: 4 } },
        { name: 'SECRET-startup', isFork: false, diskUsage: 900, stargazerCount: 0, issues: { totalCount: 0 } }] } } } });
      if (q.includes('stargazers')) return ok({ data: null });
      return ok({ data: { user: { login: 'durvesh-n-gangan', followers: { totalCount: 1 }, repositories: { nodes: [pub('NL2SQL', 0), pub('Floating-Timer', 0)] },
        contributionsCollection: { contributionCalendar: { totalContributions: 3, weeks: [] } } } } });
    }
    if (url.includes('SECRET')) throw new Error('fetched a private repo by name: ' + url);
    return ok([{ commit: { author: { date: '2026-11-15' }, message: 'public commit' } }]);
  };
  try {
    const raw = await fetchRaw('durvesh-n-gangan', 'x');
    const d = derive(raw, { todayISO: today });
    if (JSON.stringify(raw).includes('SECRET')) { fails++; console.error('FAIL private repo name kept in fetched data'); }
    if (raw.private_towers.length !== 2) { fails++; console.error('FAIL expected 2 private towers'); }
    if (d.repo_count !== 2) { fails++; console.error('FAIL repo count should only include public repos'); }
    for (const t of THEMES) {
      const svg = render(t, d);
      if (svg.includes('SECRET') || raw.private_towers.some((p) => svg.includes(p.id))) { fails++; console.error(`FAIL ${t.name}: private repo leaked into picture`); }
      if ((svg.match(/tw beacon/g) || []).length !== 1) { fails++; console.error(`FAIL ${t.name}: private repo with issues should have one antenna`); }
    }
    const noKey = await (async () => { globalThis.fetch = async (url, o) => (url.endsWith('/graphql') && JSON.parse(o.body).query.includes('viewer') ? ok({ errors: [{ message: 'Resource not accessible by integration' }] }) : realFetch === undefined ? ok([]) : ok({ data: { user: { login: 'durvesh-n-gangan', followers: { totalCount: 1 }, repositories: { nodes: [pub('NL2SQL', 0)] }, contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } } })); return fetchRaw('durvesh-n-gangan', 'x'); })();
    if (noKey.private_towers.length !== 0) { fails++; console.error('FAIL without a personal key there should be no private towers'); }
  } finally { globalThis.fetch = realFetch; }
  console.log('private repos checked: unnamed, issue antennas, no leaks');
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
