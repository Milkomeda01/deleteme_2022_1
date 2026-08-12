/* ══════════════════════════════════════════════════════════════════════════
   BUNDLE — assemble le site en UN seul fichier HTML.
   ══════════════════════════════════════════════════════════════════════════
   Le site multi-fichiers reste la version de référence : c'est elle qu'on
   édite et qu'on déploie. Ce script produit une copie autonome, utile pour
   ce qu'un dossier ne sait pas faire — s'envoyer par e-mail, s'ouvrir hors
   ligne, se poser sur un hébergeur qui n'accepte qu'une page.

   Il inline le CSS, encode les polices en data: URI et concatène les modules
   JavaScript en retirant leurs `import` / `export` : les modules ES exigent
   un serveur, or ce fichier doit s'ouvrir sans.

     node scripts/bundle.mjs                  → dist/index.html (page complète)
     node scripts/bundle.mjs --fragment       → sans <html>/<head>/<body>
     node scripts/bundle.mjs --title "Nom"    → remplace le <title>
     node scripts/bundle.mjs --out chemin.html
   ══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

/* ── Feuilles de style ──────────────────────────────────────────────────── */

// Les polices deviennent des data: URI. C'est ce qui pèse le plus lourd dans
// le fichier final, et c'est aussi ce qui garantit que le rendu ne dépend
// plus d'aucune requête.
const inlineFonts = (css) =>
  css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, file) => {
    const b64 = readFileSync(join(ROOT, 'assets/fonts', file)).toString('base64');
    return `url('data:font/woff2;base64,${b64}')`;
  });

const screenCss = ['tokens', 'base', 'sections']
  .map((n) => inlineFonts(read(`assets/css/${n}.css`)))
  .join('\n');
const printCss = read('assets/css/print.css');

/* ── JavaScript ─────────────────────────────────────────────────────────────
   L'ordre est celui des dépendances : chaque fichier ne peut utiliser que ce
   que les précédents ont défini. `main.js` s'exécute, il vient donc en
   dernier. */

const MODULES = [
  'core/utils.js', 'core/scroll.js', 'core/split.js', 'core/reveal.js',
  'modules/loader.js', 'modules/gl.js', 'modules/cursor.js', 'modules/nav.js',
  'modules/sections.js', 'modules/misc.js', 'main.js',
];

const js = MODULES.map((file) => {
  const src = read(`assets/js/${file}`);
  return `/* ── ${file} ────────────────────────────── */\n` + src
    .replace(/^import[^;]+;\s*$/gm, '')            // les liens entre fichiers
    .replace(/^export\s+(?=(?:function|const|class|let|var)\b)/gm, '');
}).join('\n');

/* ── Assemblage ─────────────────────────────────────────────────────────── */

const html = read('index.html');
const bodyStart = html.indexOf('<body>') + '<body>'.length;
const bodyEnd = html.indexOf('</body>');
let body = html.slice(bodyStart, bodyEnd);

// La balise de script externe est remplacée par le code concaténé.
body = body.replace(/<script type="module"[^>]*><\/script>/, '');

const title = value('--title', (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'CV');
const jsonLd = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [''])[0];
const bootScript = (html.match(/<script>\s*\/\/ Retiré[\s\S]*?<\/script>/) || [''])[0];

// L'en-tête du document : titre, données structurées, styles, amorce.
const head = `<title>${title}</title>
${jsonLd}
<style>
${screenCss}
</style>
<style media="print">
${printCss}
</style>
${bootScript}`;

const script = `<script type="module">
${js}
</script>`;

// En mode fragment, l'hôte fournit lui-même <html>, <head> et <body> : on ne
// livre que le contenu, styles compris (une <style> dans le corps est valide).
const out = flag('--fragment')
  ? `${head}\n${body}\n${script}`
  : `<!doctype html>
<html lang="fr" class="no-js">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
${head}
</head>
<body>
${body}
${script}
</body>
</html>`;

// `resolve` accepte aussi bien un chemin absolu qu'un chemin relatif au projet.
const dest = resolve(ROOT, value('--out', 'dist/index.html'));
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);

console.log(`${dest} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} Ko`);
