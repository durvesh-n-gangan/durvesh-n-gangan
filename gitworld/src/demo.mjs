// Sample data for previews before your real username is set.
// Shaped like a student profile: ~118 contributions, mostly in August and
// November. All repo names and commit messages here are placeholders.
import { rng } from './svg.mjs';

export function demoRaw(todayISO) {
  const R = rng(118);
  const end = Date.parse(todayISO + 'T12:00:00Z');
  const calendar = [];
  for (let k = 364; k >= 0; k--) {
    const date = new Date(end - k * 86400000).toISOString().slice(0, 10);
    const m = Number(date.slice(5, 7));
    let count = 0;
    if (m === 8 && R() < 0.45) count = 1 + Math.floor(R() * 9);
    else if (m === 11 && k < 14 && R() < 0.5) count = 1 + Math.floor(R() * 6);
    else if (m === 4 && R() < 0.05) count = 2;
    calendar.push({ date, count });
  }
  calendar[calendar.length - 1].count = 3;
  calendar[calendar.length - 2].count = 2;
  calendar[calendar.length - 3].count = 4;
  const total = calendar.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...calendar.map((d) => d.count));
  for (const d of calendar) d.level = d.count === 0 ? 0 : Math.min(4, 1 + Math.floor(((d.count - 1) / max) * 4));
  const ago = (days) => new Date(end - days * 86400000).toISOString();
  return {
    username: 'demo-user',
    followers: 12,
    contributions: total,
    calendar,
    repos: [
      { name: 'portfolio', language: 'TypeScript', language_color: '#3178c6', stars: 6, size_kb: 2400, pushed_at: ago(1), open_issues: 1, open_prs: 1, last_starred_at: ago(5) },
      { name: 'ml-notebooks', language: 'Jupyter Notebook', language_color: '#DA5B0B', stars: 3, size_kb: 9000, pushed_at: ago(3), open_issues: 0, open_prs: 0 },
      { name: 'dsa-practice', language: 'C++', language_color: '#f34b7d', stars: 2, size_kb: 800, pushed_at: ago(9), open_issues: 0, open_prs: 0 },
      { name: 'college-projects', language: 'Python', language_color: '#3572A5', stars: 1, size_kb: 5200, pushed_at: ago(20), open_issues: 1, open_prs: 0 },
      { name: 'web-app', language: 'JavaScript', language_color: '#f1e05a', stars: 4, size_kb: 3100, pushed_at: ago(40), open_issues: 0, open_prs: 0 },
      { name: 'cli-tool', language: 'Python', language_color: '#3572A5', stars: 0, size_kb: 300, pushed_at: ago(70), open_issues: 0, open_prs: 0 },
      { name: 'dotfiles', language: 'Shell', language_color: '#89e051', stars: 0, size_kb: 40, pushed_at: ago(100), open_issues: 0, open_prs: 0 },
    ],
    recent_commits: ['feat: add contact form', 'fix: navbar on mobile', 'docs: update readme', 'refactor: split utils'],
  };
}
