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
  const layout = (repos, priv = []) => layoutCity({ username: 'durvesh-n-gangan', repos, private_towers: priv });
  const order = (repos, priv = []) => layout(repos, priv).map((b) => b.repo.name);
  const before = order(all), after = order(all.filter((r) => r.name !== 'AnimeRecommender'));
  if (before.length !== all.length) { fails++; console.error(`FAIL expected ${all.length} towers, got ${before.length}`); }
  if (after.join() !== before.filter((n) => n !== 'AnimeRecommender').join()) { fails++; console.error(`FAIL towers reordered: ${before} -> ${after}`); }
  const fifteen = order([...all, repo('durvesh-n-gangan', 50)], Array.from({ length: 9 }, (_, i) => ({ id: 'p' + i, size_kb: 100 * i, stars: 0, open_issues: 0 })));
  if (fifteen.length !== 15) { fails++; console.error(`FAIL 6 public + 9 private should give 15 towers, got ${fifteen.length}`); }
  if (layout(all).some((b) => b.small)) { fails++; console.error('FAIL the street should have towers only, no houses'); }
  for (const n of [0, 1, 7, 15, 33, 60]) {
    const got = layout(Array.from({ length: n }, (_, i) => repo('r' + i, 100 * i))).length;
    if (got !== n) { fails++; console.error(`FAIL ${n} repos gave ${got} towers`); }
  }
  // The profile repo is a tower but never gets a name sign.
  const withProfile = derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [], repos: [...all, { ...repo('durvesh-n-gangan', 300), profile: true }], recent_commits: [] }, { todayISO: today });
  for (const t of THEMES) if (/>durvesh-n[^<&'@]*</.test(render(t, withProfile).replace(/<title>[\s\S]*?<\/title>/, ''))) { fails++; console.error(`FAIL ${t.name}: profile repo got a name sign`); }
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
      if (q.includes('commitContributionsByRepository')) return ok({ data: { viewer: { contributionsCollection: { commitContributionsByRepository: [
        { repository: { name: 'SECRET-diary' }, contributions: { nodes: [{ occurredAt: today + 'T10:00:00Z', commitCount: 7 }] } }] } },
        user: { contributionsCollection: { commitContributionsByRepository: [{ repository: { name: 'NL2SQL' }, contributions: { nodes: [{ occurredAt: today + 'T09:00:00Z', commitCount: 2 }] } }] } } } });
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
    const raw = await fetchRaw('durvesh-n-gangan', 'x', { privateToken: 'y' });
    const d = derive(raw, { todayISO: today });
    if (JSON.stringify(raw).includes('SECRET')) { fails++; console.error('FAIL private repo name kept in fetched data'); }
    if (raw.private_towers.length !== 2) { fails++; console.error('FAIL expected 2 private towers'); }
    if (d.private_towers.find((p) => p.size_kb === 5000)?.day_counts?.[today] !== 7) { fails++; console.error('FAIL private repo history should count 7 commits today'); }
    if (d.repos.find((r) => r.name === 'NL2SQL')?.day_counts?.[today] !== 2) { fails++; console.error('FAIL public repo history should count 2 commits today'); }
    if (d.repo_count !== 2) { fails++; console.error('FAIL repo count should only include public repos'); }
    for (const t of THEMES) {
      const svg = render(t, d);
      if (svg.includes('SECRET') || raw.private_towers.some((p) => svg.includes(p.id))) { fails++; console.error(`FAIL ${t.name}: private repo leaked into picture`); }
      if ((svg.match(/tw beacon/g) || []).length !== 1) { fails++; console.error(`FAIL ${t.name}: private repo with issues should have one antenna`); }
    }
    const noKey = await (async () => { globalThis.fetch = async (url, o) => (url.endsWith('/graphql') && JSON.parse(o.body).query.includes('viewer') ? ok({ errors: [{ message: 'Resource not accessible by integration' }] }) : realFetch === undefined ? ok([]) : ok({ data: { user: { login: 'durvesh-n-gangan', followers: { totalCount: 1 }, repositories: { nodes: [pub('NL2SQL', 0)] }, contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [] } } } } })); return fetchRaw('durvesh-n-gangan', 'x', { privateToken: 'expired' }); })();
    if (noKey.private_towers.length !== 0) { fails++; console.error('FAIL without a personal key there should be no private towers'); }
  } finally { globalThis.fetch = realFetch; }
  console.log('private repos checked: unnamed, issue antennas, no leaks');
}

// Windows: lights fill each building as high as its repo is recent.
{
  const t = THEMES.find((x) => x.name === 'classic-blue');
  const at = (iso) => derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [],
    repos: ['a', 'b', 'c', 'd', 'e'].map((n) => ({ name: n, fork: false, stars: 0, size_kb: 2000, pushed_at: iso })), recent_commits: [] }, { todayISO: today });
  const litCount = (svg) => t.win.reduce((n, c) => n + (svg.split(`fill="${c}"`).length - 1), 0);
  const fresh = litCount(render(t, at(today + 'T08:00:00Z'))), month = litCount(render(t, at('2026-10-16T08:00:00Z'))), old = litCount(render(t, at('2025-06-01T08:00:00Z')));
  if (!(fresh > month && month > old && old > 0)) { fails++; console.error(`FAIL lit windows should drop with age: today ${fresh}, month ${month}, old ${old}`); }
  console.log(`windows by recency: today ${fresh} lit, a month ago ${month}, over a year ${old}`);
}

// Windows are days: the top-right window is today, each lit window is a day
// with commits, and more commits that day = a stronger colour.
{
  const { layoutCity } = await import('./src/render.mjs');
  const back = (k) => new Date(Date.parse(today + 'T12:00:00Z') - k * 86400000).toISOString().slice(0, 10);
  const mk = (days) => derive({ username: 'durvesh-n-gangan', followers: 1, contributions: 5, calendar: [],
    repos: [{ name: 'solo', fork: false, stars: 0, size_kb: 3000, pushed_at: today + 'T08:00:00Z', commit_days: days }], recent_commits: [] }, { todayISO: today });
  for (const t of THEMES) {
    const d = mk([[back(0), 10], [back(1), 1], [back(5), 3], [back(900), 50]]);
    const svg = render(t, d), bld = layoutCity(d)[0];
    const wins = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="(#[0-9a-f]+)"( class="tw")?/g)]
      .filter((m) => +m[3] <= 6 && +m[4] <= 8 && +m[1] >= bld.x && +m[1] < bld.x + bld.w && +m[2] > bld.y && +m[2] < 204)
      .map((m) => ({ x: +m[1], y: +m[2], f: m[5], tw: !!m[6] }));
    const lit = wins.filter((w) => w.f !== (t.dwin || '').toLowerCase() && w.f !== t.dwin);
    const top = wins.reduce((a, w) => (w.y < a.y || (w.y === a.y && w.x > a.x) ? w : a), wins[0]);
    if (lit.length !== 3) { fails++; console.error(`FAIL ${t.name}: expected 3 lit day-windows, got ${lit.length}`); continue; }
    if (!top || !top.tw || !lit.includes(top)) { fails++; console.error(`FAIL ${t.name}: today's window (top-right) should be lit and flicker`); }
    if (new Set(lit.map((w) => w.f)).size !== 3) { fails++; console.error(`FAIL ${t.name}: 10, 1 and 3 commits should give 3 different intensities`); }
  }
  console.log('day windows checked in every theme: today top-right, 3 intensities, old days not shown');
}

// Buildings stand in creation order: oldest left, newest right, public and
// private mixed by date; a new repo appears at the right end.
{
  const { layoutCity } = await import('./src/render.mjs');
  const pubR = (name, created) => ({ name, fork: false, stars: 0, size_kb: 500, pushed_at: '2026-11-01T00:00:00Z', created_at: created });
  const repos = [pubR('third', '2025-03-01T00:00:00Z'), pubR('first', '2023-01-10T00:00:00Z'), pubR('fifth', '2026-09-09T00:00:00Z')];
  const priv = [{ id: 'second', size_kb: 900, stars: 0, open_issues: 0, created_at: '2024-06-01T00:00:00Z' }, { id: 'fourth', size_kb: 100, stars: 0, open_issues: 0, created_at: '2026-01-01T00:00:00Z' }];
  const names = (r, p) => layoutCity({ username: 'durvesh-n-gangan', repos: r, private_towers: p }).map((b) => b.repo.name).join(',');
  const got = names(repos, priv);
  if (got !== 'first,second,third,fourth,fifth') { fails++; console.error(`FAIL buildings should be in creation order, got ${got}`); }
  const withNew = names([...repos, pubR('brand-new', '2026-11-15T00:00:00Z')], priv);
  if (withNew !== got + ',brand-new') { fails++; console.error(`FAIL a new repo should appear at the right end, got ${withNew}`); }
  const xs = layoutCity({ username: 'durvesh-n-gangan', repos, private_towers: priv }).map((b) => b.x);
  if (xs.some((x, i) => i && x <= xs[i - 1])) { fails++; console.error('FAIL buildings should run left to right'); }
  console.log('creation order checked: oldest left, newest right, new repos join on the right');
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
