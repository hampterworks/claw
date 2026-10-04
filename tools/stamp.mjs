// Cache-busting for GitHub Pages (which lets browsers reuse files for 10 minutes).
// Rewrites the import maps and entry <script> tags so every JS module URL carries
// a hash of its contents: change a file, its URL changes, browsers fetch it fresh.
//
// Run after editing any JS:   node tools/stamp.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}

const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
const modules = walk(path.join(root, 'js')).map((f) => ({ path: rel(f), v: hash(f) }));

// Each page only lists the modules it can reach (the arcade never mentions the secret game).
const PAGES = [
  { file: 'index.html', entry: 'js/main.js', include: (p) => !p.startsWith('js/games/sim/') && p !== 'js/glorp.js', three: false },
  { file: 'glorp/index.html', entry: 'js/glorp.js', include: (p) => p !== 'js/main.js' && !/^js\/games\/[^/]+\.js$/.test(p), three: true },
];

for (const page of PAGES) {
  const file = path.join(root, page.file);
  let html = fs.readFileSync(file, 'utf8');
  const imports = {};
  if (page.three) {
    imports.three = './vendor/three/three.module.js';
    imports['three/addons/'] = './vendor/three/addons/';
  }
  for (const m of modules.filter((m) => page.include(m.path))) imports[`./${m.path}`] = `./${m.path}?v=${m.v}`;
  const map = `<script type="importmap">\n${JSON.stringify({ imports }, null, 2)
    .split('\n')
    .map((l) => '      ' + l)
    .join('\n')}\n    </script>`;
  if (/<script type="importmap">[\s\S]*?<\/script>/.test(html)) html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, map);
  else html = html.replace(/\n\s*<\/head>/, `\n    ${map}\n  </head>`);
  const entry = modules.find((m) => m.path === page.entry);
  html = html.replace(new RegExp(`src="${page.entry.replace('.', '\\.')}(\\?v=[0-9a-f]+)?"`), `src="${page.entry}?v=${entry.v}"`);
  fs.writeFileSync(file, html);
  console.log(`${page.file}: ${Object.keys(imports).length} entries, entry ${page.entry}?v=${entry.v}`);
}
