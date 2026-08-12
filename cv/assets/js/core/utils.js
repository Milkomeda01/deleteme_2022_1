/* Petites fonctions partagées. Rien d'astucieux ici, mais tout le reste
   en dépend : une seule définition de `lerp`, une seule lecture des
   préférences système. */

export const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);

/** Interpolation image par image. `t` est un taux, pas une durée. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Remappe `v` de [a,b] vers [c,d], borné. */
export const mapRange = (v, a, b, c, d) => c + (clamp((v - a) / (b - a)) * (d - c));

/** Ramène un lissage exprimé à 60 fps à la fréquence réelle de l'écran.
 *  Sans ça, l'inertie est deux fois plus rapide sur un écran 120 Hz. */
export const damp = (a, b, t, dt) => lerp(a, b, 1 - Math.pow(1 - t, dt * 60));

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches;

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── Boucle d'animation unique ─────────────────────────────────────────────
   Un seul requestAnimationFrame pour tout le site. Empiler une boucle par
   module est la première cause de saccade sur ce genre de page. */
const subscribers = new Set();
let last = performance.now();
let running = false;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); // un onglet en arrière-plan
  last = now;                                    // rend des dt énormes
  for (const fn of subscribers) fn(dt, now);
  if (subscribers.size) requestAnimationFrame(frame);
  else running = false;
}

export function onTick(fn) {
  subscribers.add(fn);
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  return () => subscribers.delete(fn);
}

/** Regroupe les redimensionnements : ils arrivent par rafales. */
export function onResize(fn, delay = 150) {
  let id;
  const run = () => { clearTimeout(id); id = setTimeout(fn, delay); };
  window.addEventListener('resize', run, { passive: true });
  window.addEventListener('orientationchange', run, { passive: true });
  return run;
}
