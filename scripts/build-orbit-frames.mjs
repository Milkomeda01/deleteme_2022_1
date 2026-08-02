/**
 * Génère une séquence d'images d'orbite autour d'une maquette de maison.
 *
 * C'est un PLACEHOLDER de démonstration : il produit un volume blanc, comme la
 * maquette d'étude d'un architecte, pour montrer le mécanisme d'animation.
 * En production, ces images seront remplacées par un rendu 360° exporté depuis
 * le modèle 3D du projet (même nombre de fichiers, même nommage).
 *
 *   node scripts/build-orbit-frames.mjs
 *   → public/orbite/frame-000.webp … frame-047.webp
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT = 'public/orbite';
const FRAMES = 48;
const W = 1400;
const H = 900;

/* ---------- petit moteur 3D : projection + peintre ---------- */

const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];

const CAM_Y = 1.5, DIST = 11.5, FOV = 1.12;

function project([x, y, z], camY = CAM_Y, dist = DIST, fov = FOV) {
  const zc = z + dist;
  const s = (H * fov) / Math.max(zc, 0.001);
  return [W / 2 + x * s, H / 2 + (camY - y) * s, zc];
}

/** Un pavé droit, décrit par ses 6 faces (sommets en sens direct). */
function box(cx, cy, cz, w, h, d) {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy, y1 = cy + h;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  return [
    { idx: [0, 1, 2, 3], n: [0, 0, -1] },
    { idx: [5, 4, 7, 6], n: [0, 0, 1] },
    { idx: [4, 0, 3, 7], n: [-1, 0, 0] },
    { idx: [1, 5, 6, 2], n: [1, 0, 0] },
    { idx: [3, 2, 6, 7], n: [0, 1, 0] },
    { idx: [4, 5, 1, 0], n: [0, -1, 0] },
  ].map((f) => ({ pts: f.idx.map((i) => v[i]), n: f.n }));
}

/** Un toit à deux pentes : deux rampants + deux pignons. */
function gable(cx, cy, cz, w, h, d, over = 0.5) {
  const x0 = cx - w / 2 - over, x1 = cx + w / 2 + over;
  const z0 = cz - d / 2 - over, z1 = cz + d / 2 + over;
  const ridgeY = cy + h;
  const a = [x0, cy, z0], b = [x1, cy, z0], c = [x1, cy, z1], e = [x0, cy, z1];
  const r0 = [cx, ridgeY, z0], r1 = [cx, ridgeY, z1];
  return [
    { pts: [a, r0, r1, e], n: [-0.7, 0.7, 0] },
    { pts: [b, c, r1, r0], n: [0.7, 0.7, 0] },
    { pts: [a, b, r0], n: [0, 0, -1] },
    { pts: [e, r1, c], n: [0, 0, 1] },
  ];
}

// Volumétrie inspirée des maisons de l'agence : corps principal sur pilotis,
// large débord de toiture, annexe basse et terrasse.
const model = [
  ...box(0, 0.9, 0, 4.4, 1.9, 2.9).map((f) => ({ ...f, tone: 0.9 })),   // corps
  ...gable(0, 2.8, 0, 4.4, 1.15, 2.9, 0.55).map((f) => ({ ...f, tone: 1 })), // toiture
  ...box(3.1, 0, 0.6, 1.8, 1.5, 1.9).map((f) => ({ ...f, tone: 0.82 })), // annexe
  ...box(0, 0.72, 2.1, 4.4, 0.1, 1.4).map((f) => ({ ...f, tone: 0.72 })), // terrasse
  // pilotis
  ...[-1.9, -0.6, 0.6, 1.9].flatMap((x) =>
    [-1.2, 1.2].flatMap((z) => box(x, 0, z, 0.16, 0.9, 0.16).map((f) => ({ ...f, tone: 0.6 })))
  ),
];

const LIGHT = [-0.42, 0.78, -0.46];

function frame(angle) {
  const faces = [];
  for (const f of model) {
    const pts = f.pts.map((p) => rotY(p, angle));
    const n = rotY(f.n, angle);
    const proj = pts.map((p) => project(p));
    if (proj.some((p) => p[2] <= 0.1)) continue;

    // Élimination des faces arrière (sens de rotation à l'écran).
    let area = 0;
    for (let i = 0; i < proj.length; i++) {
      const [x1, y1] = proj[i], [x2, y2] = proj[(i + 1) % proj.length];
      area += x1 * y2 - x2 * y1;
    }
    if (area >= 0) continue;

    const lum = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const shade = Math.round(255 * f.tone * (0.42 + 0.58 * lum));
    faces.push({
      z: proj.reduce((s, p) => s + p[2], 0) / proj.length,
      d: proj.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
      fill: `rgb(${shade},${Math.round(shade * 0.995)},${Math.round(shade * 0.965)})`,
    });
  }
  faces.sort((a, b) => b.z - a.z); // peintre : du plus loin au plus proche

  const [, ground] = project([0, 0, 0]);
  const scale = (H * FOV) / DIST;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="#f2efe9"/>
    <ellipse cx="${W / 2}" cy="${ground.toFixed(1)}" rx="${(3.4 * scale).toFixed(1)}" ry="${(0.42 * scale).toFixed(1)}" fill="#14140f" opacity="0.06"/>
    ${faces.map((f) => `<polygon points="${f.d}" fill="${f.fill}" stroke="#14140f" stroke-opacity="0.14" stroke-width="1"/>`).join('')}
  </svg>`;
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (let i = 0; i < FRAMES; i++) {
  const svg = frame((i / FRAMES) * Math.PI * 2);
  const buf = await sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer();
  writeFileSync(join(OUT, `frame-${String(i).padStart(3, '0')}.webp`), buf);
  total += buf.length;
}

console.log(`[orbite] ${FRAMES} images générées — ${(total / 1024).toFixed(0)} Ko au total`);
