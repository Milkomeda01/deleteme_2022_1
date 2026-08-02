/**
 * Génère public/_redirects à partir de :
 *   - src/data/legacy-urls.txt  (les 255 URL de l'ancien site, extraites de son sitemap)
 *   - src/data/content.json     (les slugs du nouveau site)
 *
 * Le fichier est régénéré à chaque build : les redirections ne peuvent donc pas
 * se désynchroniser des pages réellement publiées.
 *
 *   node scripts/build-redirects.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(readFileSync(join(root, 'src/data/content.json'), 'utf8'));
const legacy = readFileSync(join(root, 'src/data/legacy-urls.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const MAISONS = '/maisons-d-architecte/';
const PV = '/centrale-photovoltaique/';
const PRO = '/batiments-professionnels/';

/** Destinations exactes des anciennes pages « details-… ». */
const exact = new Map();
for (const p of content.realisations) exact.set('/' + p.old, `/realisations/${p.slug}/`);
for (const p of content.conseils) exact.set('/' + p.old, `/conseils/${p.slug}/`);
// Les principes bioclimatiques sont regroupés sur une seule page.
for (const p of content.details) exact.set('/' + p.old, '/savoir-faire/');

/** Pages de rubrique et pages système de l'ancien CMS. */
const fixed = new Map(
  Object.entries({
    '/contact': '/contact/',
    '/mentions-legales': '/mentions-legales/',
    '/politique-de-confidentialite': '/politique-de-confidentialite/',
    '/plan-du-site': '/plan-du-site/',
    '/maison-d-architecte-w1': MAISONS,
    '/maison-d-architecte-w2': MAISONS,
    '/centrale-au-sol-photovoltaique-w0': PV,
    '/centrale-au-sol-photovoltaique-w1': PV,
    '/batiments-professionnels-w0': PRO,
    '/batiments-professionnels-w1': PRO,
    '/guide-local-w1': '/',
    '/archives-1': '/realisations/',
    '/nos-activites': '/realisations/',
    '/toutes-nos-prestations-1': '/realisations/',
    '/secteurs': '/contact/',
  })
);

const PV_RE = /photovolta|solaire|agri-?volta|ombrier|energie\+renouvelable|panneaux/;
const PRO_RE =
  /batiment\+professionnel|local\+industriel|locaux\+industriels|cabinet\+dentaire|bureaux|hangar|logement\+collectif|logements\+groupes|medic|commerc|agrandissement\+d\+un\+local|batiment\+agricole/;

/** Les pages « longue traîne » partent vers la rubrique dont elles parlent. */
function guess(url) {
  const s = url.toLowerCase();
  if (PV_RE.test(s)) return PV;
  if (PRO_RE.test(s)) return PRO;
  return MAISONS;
}

const rows = [];
for (const url of legacy) {
  if (url === '/') continue;
  let to;
  if (fixed.has(url)) to = fixed.get(url);
  else if (exact.has(url)) to = exact.get(url);
  else if (url.startsWith('/lien-')) to = '/'; // pages d'échange de liens de l'ancienne agence
  else if (/^\/[a-z+-]+-y\d+$/.test(url)) to = '/contact/'; // pages « secteur géographique »
  else to = guess(url);
  rows.push([url, to]);
}

const out = [
  "# Redirections 301 de l'ancien site vers la nouvelle arborescence.",
  '# FICHIER GÉNÉRÉ — ne pas modifier à la main.',
  '# Source : scripts/build-redirects.mjs (npm run build).',
  '',
  ...rows.map(([from, to]) => `${from} ${to} 301`),
  '',
  '# Variantes sans slash final.',
  '/realisations /realisations/ 301',
  '/conseils /conseils/ 301',
  '/savoir-faire /savoir-faire/ 301',
  '',
];

writeFileSync(join(root, 'public/_redirects'), out.join('\n'));

const counts = rows.reduce((a, [, t]) => ((a[t] = (a[t] || 0) + 1), a), {});
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
console.log(`[redirects] ${rows.length} redirections écrites dans public/_redirects`);
for (const [t, n] of top) console.log(`  ${String(n).padStart(4)} → ${t}`);
