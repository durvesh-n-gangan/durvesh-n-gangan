// Fetches real GitHub data (inside the GitHub Action, using GITHUB_TOKEN)
// and turns it into the numbers the renderer uses.

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

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
        stargazers(last:1){ edges{ starredAt } }
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

export async function fetchRaw(username, token) {
  if (!token) throw new Error('GITHUB_TOKEN is not set. Use --demo to render with sample data.');
  const json = await gh('https://api.github.com/graphql', token, { query: QUERY, variables: { login: username } });
  if (json.errors) throw new Error('GraphQL: ' + json.errors.map((e) => e.message).join('; '));
  const u = json.data.user;
  if (!u) throw new Error(`GitHub user "${username}" not found`);
  const repos = u.repositories.nodes.map((r) => ({
    name: r.name,
    fork: r.isFork,
    stars: r.stargazerCount,
    size_kb: r.diskUsage || 0,
    pushed_at: r.pushedAt,
    language: r.primaryLanguage?.name || null,
    language_color: r.primaryLanguage?.color || null,
    open_issues: r.issues.totalCount,
    open_prs: r.pullRequests.totalCount,
    last_release_at: r.releases.nodes[0]?.publishedAt || null,
    last_starred_at: r.stargazers.edges[0]?.starredAt || null,
  }));
  const calendar = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 })));

  // Latest commit messages from your most recently pushed repos.
  const recent_commits = [];
  for (const r of repos.filter((r) => !r.fork).slice(0, 3)) {
    try {
      const commits = await gh(`https://api.github.com/repos/${username}/${r.name}/commits?per_page=3&author=${username}`, token);
      for (const c of commits) recent_commits.push({ at: c.commit.author?.date, msg: c.commit.message });
    } catch { /* empty repo or no access: skip */ }
  }
  recent_commits.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    username: u.login,
    followers: u.followers.totalCount,
    contributions: u.contributionsCollection.contributionCalendar.totalContributions,
    calendar,
    repos,
    recent_commits: recent_commits.map((c) => c.msg),
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
  const own = (raw.repos || []).filter((r) => !r.fork);
  const langs = {};
  for (const r of own) if (r.language) (langs[r.language] ||= { name: r.language, color: r.language_color, repos: 0 }).repos++;
  const month = new Date(todayISO + 'T12:00:00Z').getUTCMonth();
  const year = Number(todayISO.slice(0, 4));
  return {
    ...raw,
    calendar: cal,
    week: last7.reduce((s, d) => s + d.count, 0),
    streak,
    days_since_last: lastActive ? daysSince(lastActive.date + 'T12:00:00Z', today) : null,
    languages: Object.values(langs).sort((a, b) => b.repos - a.repos),
    repo_count: own.length,
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
