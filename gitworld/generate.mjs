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
const cfgUser = cfg.username && cfg.username !== 'YOUR_GITHUB_USERNAME' ? cfg.username : '';
const username = cfgUser || (inCI ? process.env.GITHUB_REPOSITORY_OWNER || '' : '');
const useDemo = flag('--demo') || (!username && !inCI);
if (!useDemo && !username) { console.error('No username: set "username" in gitworld.config.json.'); process.exit(1); }

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
writeFileSync(join(out, 'themes.json'), JSON.stringify({ date: today, live: pick, themes: THEMES.map((t) => ({ name: t.name, label: t.label, mode: t.mode || 'dark' })) }, null, 2));

// THEMES.md: a gallery page anyone can browse on GitHub, kept in sync with the code.
const rel = (cfg.output_dir || 'assets/gitworld').replace(/^\.?\/*/, '');
const md = ['# GitWorld themes', '', `Every theme below is drawn from the same data. To switch, set \`"theme"\` in \`gitworld.config.json\` (or run the **GitWorld city** workflow by hand and pick one).`, '',
  `Live right now: **${pick.dark}** for dark mode, **${pick.light}** for light mode (${pick.reason}).`, ''];
for (const t of THEMES) md.push(`### ${t.label}`, '', `\`"theme": "${t.name}"\``, '', `<img src="./${rel}/themes/${t.name}.svg" alt="${t.label} GitWorld city" width="100%">`, '');
writeFileSync(join(root, 'THEMES.md'), md.join('\n'));

console.log(`${useDemo ? 'demo data' : '@' + data.username} · ${today} · live: dark=${pick.dark}, light=${pick.light} (${pick.reason})`);
console.log(`rendered ${Object.keys(rendered).length}/${THEMES.length} themes into ${out}`);
if (failures.length) { console.error('FAILED:\n  ' + failures.join('\n  ')); process.exit(1); }
