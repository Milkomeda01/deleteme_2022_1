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
   La liste des modules est DÉDUITE du graphe d'imports, jamais écrite à la
   main. Une liste manuelle finit toujours par oublier un fichier : c'est
   arrivé avec le module du plongeon, absent du bundle alors que la version
   multi-fichiers fonctionnait — le genre de panne qu'aucun test de la page
   servie ne peut voir.

   Parcours en profondeur d'abord : un fichier n'est écrit qu'une fois toutes
   ses dépendances écrites, donc l'ordre d'exécution est correct par
   construction, et `main.js` — le seul qui exécute quelque chose — sort en
   dernier. */

const JS_ROOT = join(ROOT, 'assets/js');

function collectModules(entry, seen = new Set(), out = []) {
  const rel = entry.replace(/\\/g, '/');
  if (seen.has(rel)) return out;
  seen.add(rel);

  const src = readFileSync(join(JS_ROOT, rel), 'utf8');
  const dir = dirname(rel);

  for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
    const target = m[1];
    if (!target.startsWith('.')) {
      throw new Error(`${rel} importe « ${target} » : le bundle n'accepte que des chemins relatifs.`);
    }
    collectModules(join(dir, target), seen, out);
  }

  out.push(rel);
  return out;
}

const modules = collectModules('main.js');

const js = modules.map((file) => {
  const src = readFileSync(join(JS_ROOT, file), 'utf8');
  return `/* ── ${file} ────────────────────────────── */\n` + src
    .replace(/^\s*import\s[^'"]*['"][^'"]+['"];?\s*$/gm, '')   // les liens entre fichiers
    .replace(/^export\s+(?=(?:function|const|class|let|var)\b)/gm, '');
}).join('\n');

/* ── Assemblage ─────────────────────────────────────────────────────────── */

const html = read('index.html');
const bodyStart = html.indexOf('<body>') + '<body>'.length;
const bodyEnd = html.indexOf('</body>');
let body = html.slice(bodyStart, bodyEnd);

// La balise de script externe est remplacée par le code concaténé.
body = body.replace(/<script type="module"[^>]*><\/script>/, '');

// Les images deviennent des data: URI — sans quoi le « fichier unique » ne
// serait unique qu'en apparence et afficherait des cadres vides ailleurs.
body = body.replace(/(src=")\.\/assets\/img\/([^"]+)(")/g, (_, a, file, z) => {
  const buf = readFileSync(join(ROOT, 'assets/img', file));
  const type = file.endsWith('.svg') ? 'image/svg+xml'
    : file.endsWith('.png') ? 'image/png'
    : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return `${a}data:${type};base64,${buf.toString('base64')}${z}`;
});

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
/* ── Garde-fou ──────────────────────────────────────────────────────────────
   `main.js` protège chaque module derrière un try/catch : une fonction
   manquante y devient un simple avertissement en console, et la page continue
   comme si de rien n'était. C'est exactement ce qui a laissé passer un jeu
   absent du bundle. On vérifie donc ici que tout ce que `main.js` appelle
   existe bien dans le fichier produit. */

const called = [...read('assets/js/main.js').matchAll(/\b(init[A-Z]\w*)\s*\(/g)].map((m) => m[1]);
const missing = [...new Set(called)].filter((fn) => !new RegExp(`function\\s+${fn}\\b`).test(js));
if (missing.length) {
  console.error(`Fonctions appelées mais absentes du bundle : ${missing.join(', ')}`);
  process.exit(1);
}

const dest = resolve(ROOT, value('--out', 'dist/index.html'));
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);

console.log(`${dest} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} Ko · ${modules.length} modules`);
