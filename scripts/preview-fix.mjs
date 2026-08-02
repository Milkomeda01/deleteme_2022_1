/**
 * Post-traitement du build d'aperçu (GitHub Pages uniquement).
 *
 * Le site vit alors dans un sous-dossier (/deleteme_2022_1/) : les liens
 * internes écrits en absolu doivent être préfixés, et l'aperçu ne doit jamais
 * être indexé — il ferait doublon avec le vrai domaine.
 *
 *   PREVIEW=1 npm run build:preview
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const BASE = (process.env.PREVIEW_BASE || '/deleteme_2022_1').replace(/\/$/, '');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );

const files = walk(DIST);
let touched = 0;

for (const file of files.filter((f) => f.endsWith('.html'))) {
  let html = readFileSync(file, 'utf8');

  // Liens internes : /contact/ → /deleteme_2022_1/contact/
  // On épargne ce qui est déjà préfixé et les URL protocolaires (//, mailto:…).
  html = html.replace(/(href|action)="\/(?!\/)([^"]*)"/g, (m, attr, path) =>
    path.startsWith(BASE.slice(1)) ? m : `${attr}="${BASE}/${path}"`
  );

  // Interdit l'indexation de l'aperçu.
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    (m) => `${m}\n    <meta name="robots" content="noindex,nofollow" />`
  );

  writeFileSync(file, html);
  touched++;
}

// Ces fichiers n'ont de sens que sur le domaine de production.
for (const junk of ['_redirects', 'robots.txt']) {
  const p = join(DIST, junk);
  if (existsSync(p)) rmSync(p);
}

// Empêche GitHub Pages de passer le dossier dans Jekyll (il ignorerait _astro/).
writeFileSync(join(DIST, '.nojekyll'), '');

console.log(`[preview] ${touched} pages préfixées avec ${BASE}, indexation désactivée`);
