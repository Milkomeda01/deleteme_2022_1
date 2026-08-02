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

/**
 * Bandeau visible uniquement sur l'aperçu. Il se place au-dessus de la barre
 * d'appel mobile, qui occupe déjà le bas de l'écran.
 */
const BANNIERE = `
<style>
#apercu-bandeau{position:fixed;inset:auto 0 0 0;z-index:120;display:flex;flex-wrap:wrap;
 gap:.4rem 1.5rem;align-items:center;justify-content:center;background:#14140f;color:#fbfaf7;
 padding:.55rem 1rem;text-align:center;
 font:500 .72rem/1.45 'Inter Variable',system-ui,sans-serif;letter-spacing:.05em}
#apercu-bandeau b{color:#c8ab6d;font-weight:560}
#apercu-bandeau a{color:#c8ab6d;text-underline-offset:.25em}
/* La hauteur du bandeau varie selon qu'il tient sur une ou deux lignes :
   elle est mesurée à l'exécution plutôt que devinée. */
body{padding-bottom:var(--apercu-h,2.8rem)}
@media (max-width:62rem){
  /* !important assumé : la règle scopée d'Astro (.callbar[data-astro-cid-…])
     est plus spécifique, et ce bandeau n'existe que sur l'aperçu. */
  .callbar{bottom:var(--apercu-h,2.8rem)!important}
  body{padding-bottom:calc(var(--apercu-h,2.8rem) + 3.6rem)}
}
</style>
<div id="apercu-bandeau">
  <span><b>Aperçu</b> — version de test, non référencée.</span>
  <a href="${BASE}/demo-animation/">Voir la démo d'animation au défilement &rarr;</a>
</div>
<script>
(function () {
  var b = document.getElementById('apercu-bandeau');
  var maj = function () {
    document.documentElement.style.setProperty('--apercu-h', b.offsetHeight + 'px');
  };
  maj();
  addEventListener('resize', maj, { passive: true });
})();
</script>
`;

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

  // La canonique est calculée pour le domaine de production : sur l'aperçu
  // elle perdrait le sous-dossier. On la réaligne sur l'URL réellement servie.
  html = html.replace(
    /(<link rel="canonical" href="https?:\/\/[^/"]+)(\/[^"]*)?"/,
    (m, origin, path = '/') =>
      `${origin}${path.startsWith(BASE + '/') ? path : BASE + path}"`
  );

  // Aucun sitemap n'est produit pour l'aperçu : ce lien pointerait dans le vide.
  html = html.replace(/<link rel="sitemap"[^>]*>\s*/g, '');

  // Bandeau d'aperçu : signale qu'il ne s'agit pas du site en production et
  // rend accessible la page de démonstration, volontairement hors du menu.
  html = html.replace('</body>', BANNIERE + '</body>');

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
