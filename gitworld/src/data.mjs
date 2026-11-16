import { createHash } from 'node:crypto';
// Fetches real GitHub data (inside the GitHub Action, using GITHUB_TOKEN)
// and turns it into the numbers the renderer uses.

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// Star dates are asked for separately: if the token isn't allowed to read
// them, GitHub blanks out each whole repo, not just that one field.
const STARS_QUERY = `query($login:String!){ user(login:$login){ repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC){ nodes{ name stargazers(last:1){ edges{ starredAt } } } } } }`;

// Private repos: only readable with a personal key (the GITWORLD_TOKEN
// secret). Asked for as the key's owner ("viewer"), and only the size and
// open-issue count are kept: names never leave this file.
const PRIVATE_QUERY = `query{ viewer{ login repositories(first:100, ownerAffiliations:OWNER, privacy:PRIVATE, orderBy:{field:PUSHED_AT, direction:DESC}){ nodes{ name isFork diskUsage stargazerCount pushedAt issues(states:OPEN){ totalCount } } } } }`;

// Your commits per repo per day over the past year (GitHub's own
// contribution data). Only dates and counts are kept.
const HISTORY = `commitContributionsByRepository(maxRepositories:100){ repository{ name } contributions(first:100){ nodes{ occurredAt commitCount } } }`;
const PUBLIC_HISTORY_QUERY = `query($login:String!){ user(login:$login){ contributionsCollection{ ${HISTORY} } } }`;
const PRIVATE_HISTORY_QUERY = `query{ viewer{ contributionsCollection{ ${HISTORY} } } }`;
const historyMap = (cc) => {
  const m = new Map();
  for (const r of cc?.commitContributionsByRepository || []) {
    if (!r?.repository) continue;
    m.set(r.repository.name, (r.contributions?.nodes || []).filter(Boolean).map((n) => [String(n.occurredAt).slice(0, 10), n.commitCount || 0]));
  }
  return m;
};

const QUERY = `query($login:String!){
  user(login:$login){
    login
    followers{ totalCount }
    contributionsCollection{ contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount contributionLevel } } } }
    repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC, orderBy:{field:PUSHED_AT, direction:DESC}){
      nodes{
        name isFork stargazerCount diskUsage pushedAt
        primaryLanguage{ name color }
        issues(states:OPEN){ totalCount }
        pullRequests(states:OPEN){ totalCount }
        releases(last:1){ nodes{ publishedAt } }
      }
    }
  }
}`;

async function gh(url, token, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'gitworld-generator' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Colors GitHub uses for common languages, for when only the REST API answers.
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', 'C++': '#f34b7d', C: '#555555',
  'C#': '#178600', Go: '#00ADD8', Rust: '#dea584', HTML: '#e34c26', CSS: '#663399', 'Jupyter Notebook': '#DA5B0B',
  Shell: '#89e051', Kotlin: '#A97BFF', Swift: '#F05138', Dart: '#00B4AB', Ruby: '#701516', PHP: '#4F5D95', SCSS: '#c6538c', Vue: '#41b883',
};

const warn = (msg) => console.warn(process.env.GITHUB_ACTIONS ? `::warning title=GitWorld::${msg}` : `warning: ${msg}`);

// The workflow's built-in token may not read every detail of your other
// repos. GraphQL then returns what it can and marks the rest as errors, so
// keep the partial answer, fill gaps from the public REST API, and leave out
// anything still unknown (the city simply skips that detail).
// token: the workflow's built-in key (public data). privateToken: your own
// GITWORLD_TOKEN key, used only to count private repos. If it is missing or
// stops working (expired, deleted), the city still draws your public repos.
export async function fetchRaw(username, token, { includePrivate = true, privateToken = '' } = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is not set. Use --demo to render with sample data.');
  const json = await gh('https://api.github.com/graphql', token, { query: QUERY, variables: { login: username } });
  const u = json.data?.user;
  if (json.errors?.length) {
    const where = [...new Set(json.errors.map((e) => (e.path || []).filter((p) => typeof p === 'string').slice(1).join('.') || e.message))];
    if (!u) throw new Error('GraphQL: ' + json.errors.map((e) => e.message).join('; '));
    warn(`some details could not be read with this token and were left out: ${where.join(', ')}`);
  }
  if (!u) throw new Error(`GitHub user "${username}" not found`);

  let repos = (u.repositories?.nodes || []).filter(Boolean).map((r) => ({
    name: r.name,
    fork: r.isFork,
    stars: r.stargazerCount ?? 0,
    size_kb: r.diskUsage || 0,
    pushed_at: r.pushedAt,
    language: r.primaryLanguage?.name || null,
    language_color: r.primaryLanguage?.color || null,
    open_issues: r.issues?.totalCount ?? null,
    open_prs: r.pullRequests?.totalCount ?? null,
    last_release_at: r.releases?.nodes?.[0]?.publishedAt || null,
    last_starred_at: null,
  }));
  // Fill in any repos GraphQL left blank from the public REST list.
  if (!u.repositories || u.repositories.nodes?.some((n) => !n)) {
    const rest = await gh(`https://api.github.com/users/${username}/repos?type=owner&sort=pushed&per_page=100`, token);
    const have = new Set(repos.map((r) => r.name));
    repos = repos.concat(rest.filter((r) => !have.has(r.name) && !r.private).map((r) => ({
      name: r.name, fork: r.fork, stars: r.stargazers_count, size_kb: r.size || 0, pushed_at: r.pushed_at,
      language: r.language || null, language_color: LANG_COLORS[r.language] || (r.language ? '#8b949e' : null),
      open_issues: null, open_prs: null, last_release_at: null, last_starred_at: null,
    })));
  }
  try {
    const sj = await gh('https://api.github.com/graphql', token, { query: STARS_QUERY, variables: { login: username } });
    for (const n of sj.data?.user?.repositories?.nodes || []) {
      const r = n && repos.find((x) => x.name === n.name);
      if (r) r.last_starred_at = n.stargazers?.edges?.[0]?.starredAt || null;
    }
  } catch { /* star dates are optional */ }
  // Your profile repo (named like you) holds this city. It still counts as
  // one of your repos (it gets a tower), but no name sign and no billboard.
  for (const r of repos) if (r.name.toLowerCase() === username.toLowerCase()) r.profile = true;

  // Private repos become unnamed towers. Each gets an opaque id (a hash of
  // its name) so it keeps the same building; the name itself is dropped.
  let private_towers = [];
  if (includePrivate && privateToken) {
    try {
      const pj = await gh('https://api.github.com/graphql', privateToken, { query: PRIVATE_QUERY });
      const v = pj.data?.viewer;
      if (!v) throw new Error(pj.errors?.map((e) => e.message).join('; ') || 'no data');
      if (v.login.toLowerCase() !== username.toLowerCase()) warn(`the GITWORLD_TOKEN key belongs to ${v.login}, not ${username}, so private repos were left out`);
      else {
        let hist = null;
        try {
          const cc = (await gh('https://api.github.com/graphql', privateToken, { query: PRIVATE_HISTORY_QUERY })).data?.viewer?.contributionsCollection;
          if (cc) hist = historyMap(cc);
        } catch { /* history is optional */ }
        const nodes = (v.repositories?.nodes || []).filter(Boolean);
        // If the key can't see private commit history at all (no private repo
        // appears in it although some were pushed this year), don't draw them
        // dark: fall back to lighting by last push.
        const yearAgo = Date.now() - 365 * 86400000;
        if (hist && !nodes.some((n) => hist.has(n.name)) && nodes.some((n) => Date.parse(n.pushedAt) > yearAgo)) hist = null;
        private_towers = nodes.map((n) => ({
          id: createHash('sha1').update('private:' + n.name).digest('hex').slice(0, 12),
          size_kb: n.diskUsage || 0, stars: n.stargazerCount || 0, open_issues: n.issues?.totalCount ?? 0, pushed_at: n.pushedAt || null,
          commit_days: hist ? hist.get(n.name) || [] : null,
        }));
      }
    } catch (e) {
      warn(`your GITWORLD_TOKEN key did not work (${String(e.message).slice(0, 120)}). It may have expired: create a new one and replace the secret. Private repos were left out this time.`);
    }
  }

  // Public repos' commit history (the built-in key can read this).
  try {
    const hist = historyMap((await gh('https://api.github.com/graphql', token, { query: PUBLIC_HISTORY_QUERY, variables: { login: username } })).data?.user?.contributionsCollection);
    for (const r of repos) r.commit_days = hist.get(r.name) || [];
  } catch { /* fall back to lighting by last push */ }

  let followers = u.followers?.totalCount ?? null;
  if (followers == null) {
    try { followers = (await gh(`https://api.github.com/users/${username}`, token)).followers ?? null; } catch { /* leave unknown */ }
  }

  const cc = u.contributionsCollection?.contributionCalendar;
  const calendar = (cc?.weeks || []).flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 })));

  // Latest commit messages from your most recently pushed repos.
  const recent_commits = [];
  for (const r of repos.filter((r) => !r.fork && !r.profile).slice(0, 3)) {
    try {
      const commits = await gh(`https://api.github.com/repos/${username}/${r.name}/commits?per_page=3&author=${username}`, token);
      for (const c of commits) recent_commits.push({ repo: r.name, at: c.commit.author?.date, msg: c.commit.message.split('\n')[0] });
    } catch { /* empty repo or no access: skip */ }
  }
  recent_commits.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    username: u.login,
    followers,
    contributions: cc?.totalContributions ?? 0,
    calendar,
    repos,
    private_towers,
    recent_commits: recent_commits.map(({ repo, msg }) => ({ repo, msg })),
  };
}

const DAY = 86400000;
const daysSince = (iso, today) => (iso ? Math.max(0, Math.floor((today - Date.parse(iso)) / DAY)) : null);
const minOf = (arr) => { const v = arr.filter((x) => x != null); return v.length ? Math.min(...v) : null; };

// Turn raw data into the fields themes and features read.
export function derive(raw, { todayISO, learning = '' }) {
  const today = Date.parse(todayISO + 'T23:59:59Z');
  const cal = [...(raw.calendar || [])].filter((d) => d.date <= todayISO).sort((a, b) => a.date.localeCompare(b.date));
  const last7 = cal.slice(-7);
  let streak = 0;
  let i = cal.length - 1;
  if (i >= 0 && cal[i].count === 0) i--; // today not counted yet is fine
  for (; i >= 0 && cal[i].count > 0; i--) streak++;
  const lastActive = [...cal].reverse().find((d) => d.count > 0);
  const own = (raw.repos || []).filter((r) => !r.fork && !r.profile);
  const langs = {};
  for (const r of own) if (r.language) (langs[r.language] ||= { name: r.language, color: r.language_color, repos: 0 }).repos++;
  const month = new Date(todayISO + 'T12:00:00Z').getUTCMonth();
  const year = Number(todayISO.slice(0, 4));
  // Each repo's days since its last push: drives how many of its windows are lit.
  // Commits per month for the past 12 months: index 0 = 11 months ago,
  // index 11 = this month. null when the history couldn't be read.
  const monthIndex = (iso) => {
    const a = new Date(todayISO + 'T12:00:00Z'), b = new Date(iso + 'T12:00:00Z');
    return 11 - ((a.getUTCFullYear() - b.getUTCFullYear()) * 12 + a.getUTCMonth() - b.getUTCMonth());
  };
  const months = (days) => {
    if (!Array.isArray(days)) return null;
    const m = Array(12).fill(0);
    for (const [d, n] of days) { const i = monthIndex(d); if (i >= 0 && i <= 11) m[i] += n; }
    return m;
  };
  const withAge = (r) => ({ ...r, days_since_push: daysSince(r.pushed_at, today), months: months(r.commit_days) });
  return {
    ...raw,
    repos: (raw.repos || []).map(withAge),
    private_towers: (raw.private_towers || []).map(withAge),
    calendar: cal,
    week: last7.reduce((s, d) => s + d.count, 0),
    streak,
    days_since_last: lastActive ? daysSince(lastActive.date + 'T12:00:00Z', today) : null,
    languages: Object.values(langs).sort((a, b) => b.repos - a.repos),
    repo_count: own.length,
    // Every repository you own (public + private when the key allows), the
    // same number as the towers.
    total_repos: (raw.repos || []).length + (raw.private_towers || []).length,
    stars_total: own.reduce((s, r) => s + (r.stars || 0), 0),
    issues: own.reduce((s, r) => s + (r.open_issues || 0), 0),
    prs: own.reduce((s, r) => s + (r.open_prs || 0), 0),
    new_star_days: minOf(own.map((r) => daysSince(r.last_starred_at, today))),
    release_days: minOf(own.map((r) => daysSince(r.last_release_at, today))),
    last_push_days: minOf(own.map((r) => daysSince(r.pushed_at, today))),
    learning,
    month: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][month],
    year: month === 11 ? year + 1 : year,
  };
}
