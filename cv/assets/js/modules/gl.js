/* ══════════════════════════════════════════════════════════════════════════
   FOND WEBGL DU PREMIER ÉCRAN
   ══════════════════════════════════════════════════════════════════════════
   Un seul quad plein écran et un fragment shader : une nappe de bruit
   déformée sur elle-même (« domain warping »), qui produit ces volutes de
   lumière lentes. Pas de bibliothèque 3D — trois cents lignes de moteur
   pour un dégradé animé seraient un mauvais calcul.

   Trois garde-fous, parce qu'un fond décoratif ne doit JAMAIS coûter cher :
   — rendu à 55 % de la résolution écran (l'image est floue par nature) ;
   — mise en pause dès que le premier écran sort du champ ;
   — repli silencieux sur le dégradé CSS si le contexte WebGL est refusé.
   ══════════════════════════════════════════════════════════════════════════ */

import { onTick, onResize, damp, prefersReducedMotion } from '../core/utils.js';
import { scroll } from '../core/scroll.js';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;    // en espace normalisé, centré
uniform float u_scroll;   // 0 en haut de page, 1 en bas du premier écran

// Bruit de valeur : moins joli qu'un Perlin, deux fois moins cher, et à
// cette échelle de flou personne ne fait la différence.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);   // lissage cubique
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);    // décalage : évite les alignements
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Repère centré et corrigé du rapport d'écran : les volutes restent rondes
  // quel que soit le format de la fenêtre.
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;

  float t = u_time * 0.045;

  // Déformation du domaine : on évalue le bruit à une position elle-même
  // donnée par du bruit. C'est ce double passage qui crée les filaments.
  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + vec2(4.3, 1.9) - t));
  vec2 r = vec2(fbm(p * 1.6 + 1.7 * q + vec2(1.7, 9.2) + 0.13 * t),
                fbm(p * 1.6 + 1.7 * q + vec2(8.3, 2.8) + 0.11 * t));
  float f = fbm(p * 1.6 + 1.9 * r);

  vec3 deep = vec3(0.023, 0.027, 0.043);   // le noir bleuté du site
  vec3 blue = vec3(0.180, 0.240, 0.560);   // halo froid
  vec3 gold = vec3(0.847, 0.698, 0.416);   // accent chaud, très dosé

  vec3 col = mix(deep, blue, clamp(f * f * 2.3, 0.0, 1.0));
  col = mix(col, gold, clamp(length(r) - 0.35, 0.0, 1.0) * 0.30);

  // Lueur qui suit la souris : discrète, mais c'est elle qui donne
  // l'impression que le fond est vivant et réagit à la présence.
  float d = length(p - u_mouse);
  col += blue * exp(-d * 2.6) * 0.13;
  col += gold * exp(-d * 6.0) * 0.05;

  // Vignette : ramène le regard au centre, où se trouve le nom.
  col *= 1.0 - 0.55 * pow(length(uv - 0.5) * 1.35, 2.2);

  // Le fond s'éteint pendant qu'on quitte le premier écran, pour que la
  // transition vers la section suivante se fasse dans le noir.
  col *= 1.0 - 0.85 * u_scroll;

  // Tramage : sans lui, les aplats sombres se découpent en bandes.
  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[gl]', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

export function initGL(canvas) {
  if (!canvas) return;

  // Mouvement réduit : on garde un fond fixe, dessiné une seule fois.
  const still = prefersReducedMotion();

  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power', failIfMajorPerformanceCaveat: false,
  });
  if (!gl) return;                      // le voile CSS suffit alors

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[gl]', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // Deux triangles couvrant l'écran, envoyés une fois pour toutes.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, 'u_res'),
    time: gl.getUniformLocation(prog, 'u_time'),
    mouse: gl.getUniformLocation(prog, 'u_mouse'),
    scroll: gl.getUniformLocation(prog, 'u_scroll'),
  };

  const QUALITY = 0.55;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * QUALITY;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
  }
  resize();
  onResize(resize, 200);

  // Cible et valeur courantes : la lueur suit le curseur avec du retard,
  // ce qui la rend organique plutôt que collée au pointeur.
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left - r.width / 2) / r.height;
    mouse.ty = -(e.clientY - r.top - r.height / 2) / r.height;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 })
    .observe(canvas);

  let progress = 0;

  const draw = (time) => {
    gl.uniform1f(u.time, time);
    gl.uniform2f(u.mouse, mouse.x, mouse.y);
    gl.uniform1f(u.scroll, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (still) { draw(0); return; }

  let elapsed = 0;
  onTick((dt) => {
    if (!visible || document.hidden) return;
    elapsed += dt;
    mouse.x = damp(mouse.x, mouse.tx, 0.05, dt);
    mouse.y = damp(mouse.y, mouse.ty, 0.05, dt);
    progress = Math.min(scroll.y / Math.max(window.innerHeight, 1), 1);
    draw(elapsed);
  });
}
