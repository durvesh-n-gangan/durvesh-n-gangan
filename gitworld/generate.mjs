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
//   <output_dir>/live/gitworld-<mode>-<hash>.svg  the same live city under a
//                                     name that changes whenever the picture does;
//                                     README.md points here so browsers never
//                                     show a stale copy
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const liveDir = join(out, 'live');
mkdirSync(liveDir, { recursive: true });
const liveFiles = {};
for (const [mode, name] of [['dark', pick.dark], ['light', pick.light]]) {
  if (!rendered[name]) { failures.push(`live ${mode} theme "${name}" did not render`); continue; }
  writeFileSync(join(out, `gitworld-${mode}.svg`), rendered[name]);
  const file = `gitworld-${mode}-${createHash('sha1').update(rendered[name]).digest('hex').slice(0, 10)}.svg`;
  writeFileSync(join(liveDir, file), rendered[name]);
  liveFiles[mode] = file;
}
// Keep only the current versions.
for (const f of readdirSync(liveDir)) if (!Object.values(liveFiles).includes(f)) unlinkSync(join(liveDir, f));
writeFileSync(join(out, 'themes.json'), JSON.stringify({ user: data.username, date: today, live: pick, themes: THEMES.map((t) => ({ name: t.name, label: t.label, mode: t.mode || 'dark' })) }, null, 2));

// THEMES.md: a gallery page anyone can browse on GitHub, kept in sync with the code.
const rel = (cfg.output_dir || 'assets/gitworld').replace(/^\.?\/*/, '');
const md = ['# GitWorld themes', '', `Every theme below is drawn from the same data. To switch, set \`"theme"\` in \`gitworld.config.json\` (or run the **GitWorld city** workflow by hand and pick one).`, '',
  `Live right now: **${pick.dark}** for dark mode, **${pick.light}** for light mode (${pick.reason}).`, ''];
for (const t of THEMES) md.push(`### ${t.label}`, '', `\`"theme": "${t.name}"\``, '', `<img src="./${rel}/themes/${t.name}.svg" alt="${t.label} GitWorld city" width="100%">`, '');
writeFileSync(join(root, 'THEMES.md'), md.join('\n'));

// Point README.md at the current versions (only the image paths change).
const readmePath = join(root, 'README.md');
if (existsSync(readmePath) && liveFiles.dark && liveFiles.light) {
  const readme = readFileSync(readmePath, 'utf8');
  const esc = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const next = readme.replace(new RegExp(`\\./${esc}/(?:live/)?gitworld-(dark|light)(?:-[0-9a-f]{10})?\\.svg`, 'g'),
    (_, mode) => `./${rel}/live/${liveFiles[mode]}`);
  if (next !== readme) writeFileSync(readmePath, next);
}

console.log(`${useDemo ? 'demo data' : '@' + data.username} · ${today} · live: dark=${pick.dark}, light=${pick.light} (${pick.reason})`);
console.log(`rendered ${Object.keys(rendered).length}/${THEMES.length} themes into ${out}`);
if (failures.length) fail('FAILED:\n  ' + failures.join('\n  '));
