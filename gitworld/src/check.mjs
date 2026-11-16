// Sanity checks for a rendered SVG. These catch the class of bug that blanked
// the first previews: bad numbers in geometry and broken markup.
const GEOMETRY = /\s(?:x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height|opacity|stroke-width|dy|d|points|offset)="([^"]*)"/g;

export function checkSvg(name, svg) {
  for (const m of svg.matchAll(GEOMETRY)) {
    if (/NaN|undefined|null|Infinity/.test(m[1])) throw new Error(`${name}: bad value in ${m[0].trim()}`);
  }
  if (/style="[^"]*(NaN|undefined|Infinity)/.test(svg)) throw new Error(`${name}: bad value in a style attribute`);
  if (/>\s*(undefined|NaN)\s*</.test(svg)) throw new Error(`${name}: "undefined" or "NaN" in visible text`);
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) throw new Error(`${name}: mismatched </${m[2]}>`); }
    else stack.push(m[2]);
  }
  if (stack.length) throw new Error(`${name}: unclosed <${stack.at(-1)}>`);
  if (svg.length > 1_500_000) throw new Error(`${name}: file too large (${svg.length} bytes)`);
}
