/**
 * Convertit une séquence d'images TGA (export d'un rendu 3D) en images WebP
 * prêtes pour l'animation au défilement.
 *
 * Trois raisons d'exister :
 *  1. les moteurs de rendu exportent volontiers en TGA, que sharp ne lit pas —
 *     le format est décodé ici à la main (en-tête de 18 octets, pixels BGRA) ;
 *  2. les rendus sortent avec de larges marges vides : on recadre sur le sujet,
 *     avec une SEULE boîte commune à toutes les images, sans quoi le bâtiment
 *     sauterait d'une image à l'autre ;
 *  3. la transparence est conservée, pour que le fond de la page transparaisse.
 *
 *   node scripts/tga-to-frames.mjs <dossier-source> [dossier-sortie]
 *   → public/orbite/frame-000.webp …
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2];
const OUT = process.argv[3] || 'public/orbite';
const WIDTH = Number(process.env.FRAME_W || 1500);
const QUALITY = Number(process.env.FRAME_Q || 74);
/** Marge conservée autour du sujet, en proportion de la boîte englobante. */
const MARGE = Number(process.env.FRAME_MARGIN || 0.03);
/** Au-dessus de ce seuil d'opacité, un pixel compte comme du sujet. */
const SEUIL_ALPHA = 8;

if (!SRC) {
  console.error('Usage : node scripts/tga-to-frames.mjs <dossier-source> [sortie]');
  process.exit(1);
}

/** Décode un TGA true-color, compressé (type 10) ou non (type 2). */
function decodeTga(buf) {
  const idLength = buf[0];
  const colorMapType = buf[1];
  const imageType = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16];
  const descriptor = buf[17];

  if (colorMapType !== 0) throw new Error('TGA à palette non pris en charge');
  if (imageType !== 2 && imageType !== 10) throw new Error(`type TGA ${imageType} non pris en charge`);
  if (bpp !== 24 && bpp !== 32) throw new Error(`${bpp} bits par pixel non pris en charge`);

  const channels = bpp / 8;
  const pixels = Buffer.alloc(width * height * 4);
  let src = 18 + idLength;
  let dst = 0;

  const ecrire = (b, g, r, a) => {
    pixels[dst++] = r; pixels[dst++] = g; pixels[dst++] = b; pixels[dst++] = a;
  };

  if (imageType === 2) {
    for (let i = 0; i < width * height; i++) {
      ecrire(buf[src], buf[src + 1], buf[src + 2], channels === 4 ? buf[src + 3] : 255);
      src += channels;
    }
  } else {
    while (dst < pixels.length) {
      const paquet = buf[src++];
      const nb = (paquet & 0x7f) + 1;
      if (paquet & 0x80) {
        const b = buf[src], g = buf[src + 1], r = buf[src + 2];
        const a = channels === 4 ? buf[src + 3] : 255;
        src += channels;
        for (let i = 0; i < nb; i++) ecrire(b, g, r, a);
      } else {
        for (let i = 0; i < nb; i++) {
          ecrire(buf[src], buf[src + 1], buf[src + 2], channels === 4 ? buf[src + 3] : 255);
          src += channels;
        }
      }
    }
  }

  // Bit 5 du descripteur : origine en haut. Sinon les lignes sont inversées.
  const hautEnBas = (descriptor & 0x20) !== 0;
  if (!hautEnBas) {
    const ligne = width * 4;
    for (let y = 0; y < height >> 1; y++) {
      const a = y * ligne, b = (height - 1 - y) * ligne;
      const tmp = Buffer.from(pixels.subarray(a, a + ligne));
      pixels.copy(pixels, a, b, b + ligne);
      tmp.copy(pixels, b);
    }
  }

  return { data: pixels, width, height, opaque: channels === 3 };
}

/** Boîte englobante des pixels non transparents. */
function boiteSujet({ data, width, height, opaque }) {
  if (opaque) return { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > SEUIL_ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: width - 1, y1: height - 1 } : { x0, y0, x1, y1 };
}

/** Trie 1, 2, 10 dans l'ordre humain plutôt qu'alphabétique. */
const ordreNaturel = (a, b) => {
  const na = parseInt(basename(a), 10);
  const nb = parseInt(basename(b), 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b);
  return na - nb;
};

const fichiers = readdirSync(SRC)
  .filter((f) => /\.tga$/i.test(f) && !f.startsWith('._'))
  .sort(ordreNaturel);

if (!fichiers.length) {
  console.error(`Aucun fichier .tga dans ${SRC}`);
  process.exit(1);
}

// 1re passe : décodage et boîte commune.
console.log(`Lecture de ${fichiers.length} images…`);
const images = fichiers.map((f) => decodeTga(readFileSync(join(SRC, f))));
const union = images.reduce(
  (acc, img) => {
    const b = boiteSujet(img);
    return {
      x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0),
      x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1),
    };
  },
  { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
);

const { width: W0, height: H0 } = images[0];
const margeX = Math.round((union.x1 - union.x0) * MARGE);
const margeY = Math.round((union.y1 - union.y0) * MARGE);
const crop = {
  left: Math.max(0, union.x0 - margeX),
  top: Math.max(0, union.y0 - margeY),
};
crop.width = Math.min(W0, union.x1 + margeX + 1) - crop.left;
crop.height = Math.min(H0, union.y1 + margeY + 1) - crop.top;

console.log(
  `Recadrage commun : ${crop.width}×${crop.height} ` +
    `(sur ${W0}×${H0}, soit ${Math.round((crop.width * crop.height * 100) / (W0 * H0))} % de la surface)`
);

// 2e passe : recadrage, redimensionnement, encodage.
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const [i, img] of images.entries()) {
  const buf = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .extract(crop)
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 90 })
    .toBuffer();

  writeFileSync(join(OUT, `frame-${String(i).padStart(3, '0')}.webp`), buf);
  total += buf.length;
}

const meta = await sharp(join(OUT, 'frame-000.webp')).metadata();
console.log(
  `\n[orbite] ${images.length} images → ${OUT}\n` +
    `         ${meta.width}×${meta.height}, ${(total / 1024).toFixed(0)} Ko au total ` +
    `(${(total / images.length / 1024).toFixed(0)} Ko par image)`
);
