/* ══════════════════════════════════════════════════════════════════════════
   POINT D'ENTRÉE
   ══════════════════════════════════════════════════════════════════════════
   Ordre volontaire :
   1. ce qui doit exister avant que la page bouge (défilement, fond, curseur) ;
   2. le voile de chargement, qui retient tout le reste ;
   3. les animations d'entrée, une fois le voile levé — sinon elles se jouent
      derrière lui et le visiteur ne voit qu'une page déjà terminée.

   Si un module échoue, il échoue seul : chaque appel est isolé, une erreur
   dans le fond WebGL ne doit pas emporter la navigation avec elle.
   ══════════════════════════════════════════════════════════════════════════ */

import { $ } from './core/utils.js';
import { scroll } from './core/scroll.js';
import { initReveal } from './core/reveal.js';
import { initLoader } from './modules/loader.js';
import { initGL } from './modules/gl.js';
import { initCursor, initMagnetic } from './modules/cursor.js';
import { initNav } from './modules/nav.js';
import { initManifesto, initCounters, initTrack, initSkills, initMarquee } from './modules/sections.js';
import { initClock, initYear, initCopy, initPrint } from './modules/misc.js';

const safe = (name, fn) => {
  try { return fn(); }
  catch (err) { console.warn(`[cv] module « ${name} » ignoré :`, err); }
};

// Le navigateur restaure la position de défilement au rechargement, ce qui
// donne une page à moitié animée derrière le voile de chargement.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

safe('gl', () => initGL($('[data-gl]')));
safe('cursor', () => initCursor($('[data-cursor]')));
safe('nav', () => initNav());
safe('clock', () => initClock($('[data-clock]')));
safe('year', () => initYear());
safe('copy', () => initCopy());
safe('print', () => initPrint());
safe('skills', () => initSkills());

initLoader($('[data-loader]')).then(() => {
  window.scrollTo(0, 0);
  scroll.measure();

  safe('reveal', () => initReveal());
  safe('magnetic', () => initMagnetic());
  safe('manifesto', () => initManifesto());
  safe('counters', () => initCounters());
  safe('track', () => initTrack());
  safe('marquee', () => initMarquee());

  document.documentElement.classList.add('is-ready');

  // Une ancre dans l'URL est honorée après coup, une fois les hauteurs
  // finales connues (la piste horizontale change la hauteur du document).
  const hash = location.hash;
  if (hash && document.querySelector(hash)) {
    requestAnimationFrame(() => scroll.to(document.querySelector(hash), { immediate: true }));
  }
});
