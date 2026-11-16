#!/usr/bin/env node
// GitWorld generator.
//
//   node gitworld/generate.mjs                 real data (needs GITHUB_TOKEN), config theme
//   node gitworld/generate.mjs --demo          sample data, no token needed
//   node gitworld/generate.mjs --theme noir    force a theme (or rotate / random)
//   node gitworld/generate.mjs --date 2026-11-08   pretend it's that date (test auto themes)
//
// Writes:
//   <output_dir>/gitworld-dark.svg    the live city for dark-mode visitors
//   <output_dir>/gitworld-light.svg   the live city for light-mode visitors
//   <output_dir>/themes/<name>.svg    every theme, for browsing and switching
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './src/themes.mjs';
import { render } from './src/render.mjs';
import { fetchRaw, derive } from './src/data.mjs';
import { demoRaw } from './src/demo.mjs';
import { selectThemes, localDate } from './src/select.mjs';
import { checkSvg } from './src/check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const cfgPath = join(root, 'gitworld.config.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
const today = opt('--date') || localDate(cfg.timezone || 'Asia/Kolkata');
const override = opt('--theme') || process.env.GITWORLD_THEME || '';
// Username: the config value, or (inside GitHub Actions) the repo owner,
// which for a profile repo is you. CI never falls back to sample data.
const inCI = !!process.env.GITHUB_ACTIONS;
// Inside GitHub Actions, "::error::" lines show up on the run's summary page,
// so a failed run says why without digging through the logs.
const fail = (msg) => {
  console.error(inCI ? `::error title=GitWorld::${String(msg).replace(/\r?\n/g, '%0A')}` : msg);
  process.exit(1);
};
process.on('uncaughtException', (e) => fail(e.message));
process.on('unhandledRejection', (e) => fail(e?.message || e));
const cfgUser = cfg.username && cfg.username !== 'YOUR_GITHUB_USERNAME' ? cfg.username : '';
const username = cfgUser || (inCI ? process.env.GITHUB_REPOSITORY_OWNER || '' : '');
const useDemo = flag('--demo') || (!username && !inCI);
if (!useDemo && !username) fail('No username: set "username" in gitworld.config.json.');

const raw = useDemo ? demoRaw(today) : await fetchRaw(username, process.env.GITHUB_TOKEN);
const data = derive(raw, { todayISO: today, learning: cfg.learning || '' });
const out = join(root, cfg.output_dir || 'assets/gitworld');
mkdirSync(join(out, 'themes'), { recursive: true });

const rendered = {};
const failures = [];
for (const t of THEMES) {
  try {
    const svg = render(t, data);
    checkSvg(t.name, svg);
    writeFileSync(join(out, 'themes', `${t.name}.svg`), svg);
    rendered[t.name] = svg;
  } catch (e) {
    failures.push(`${t.name}: ${e.message}`);
  }
}

const pick = selectThemes(cfg, today, override);
for (const [mode, name] of [['dark', pick.dark], ['light', pick.light]]) {
  if (!rendered[name]) { failures.push(`live ${mode} theme "${name}" did not render`); continue; }
  writeFileSync(join(out, `gitworld-${mode}.svg`), rendered[name]);
}
writeFileSync(join(out, 'themes.json'), JSON.stringify({ user: data.username, date: today, live: pick, themes: THEMES.map((t) => ({ name: t.name, label: t.label, mode: t.mode || 'dark' })) }, null, 2));

// THEMES.md: a gallery page anyone can browse on GitHub, kept in sync with the code.
const rel = (cfg.output_dir || 'assets/gitworld').replace(/^\.?\/*/, '');
const md = ['# GitWorld themes', '', `Every theme below is drawn from the same data. To switch, set \`"theme"\` in \`gitworld.config.json\` (or run the **GitWorld city** workflow by hand and pick one).`, '',
  `Live right now: **${pick.dark}** for dark mode, **${pick.light}** for light mode (${pick.reason}).`, ''];
for (const t of THEMES) md.push(`### ${t.label}`, '', `\`"theme": "${t.name}"\``, '', `<img src="./${rel}/themes/${t.name}.svg" alt="${t.label} GitWorld city" width="100%">`, '');
writeFileSync(join(root, 'THEMES.md'), md.join('\n'));

// README theme switcher: visitors open "Switch theme" and unfold any city.
// Only the text between the two marker comments is replaced.
const readmePath = join(root, 'README.md');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  const start = readme.match(/<!-- gitworld:switcher[^>]*-->/), end = '<!-- /gitworld:switcher -->';
  if (start && readme.includes(end)) {
    const order = [pick.dark, ...THEMES.map((t) => t.name).filter((n) => n !== pick.dark)];
    const label = (n) => THEMES.find((t) => t.name === n).label;
    const page = cfg.switcher_page ? `https://${data.username.toLowerCase()}.github.io/${data.username}/` : '';
    const block = [start[0], '<details>', '<summary><b>Switch theme</b> · open, then click any theme to see my city in it</summary>', '',
      ...order.map((n) => `<details><summary>${label(n)}${n === pick.dark ? ' (showing now)' : ''}</summary>\n\n<img src="./${rel}/themes/${n}.svg" alt="${label(n)} city" width="100%">\n\n</details>`),
      '', page ? `<sub>Or open the <a href="${page}">theme switcher page</a>, which remembers your pick.</sub>` : '', '</details>', end].join('\n');
    const next = readme.slice(0, start.index) + block + readme.slice(readme.indexOf(end) + end.length);
    if (next !== readme) writeFileSync(readmePath, next);
  }
}

console.log(`${useDemo ? 'demo data' : '@' + data.username} · ${today} · live: dark=${pick.dark}, light=${pick.light} (${pick.reason})`);
console.log(`rendered ${Object.keys(rendered).length}/${THEMES.length} themes into ${out}`);
if (failures.length) fail('FAILED:\n  ' + failures.join('\n  '));
