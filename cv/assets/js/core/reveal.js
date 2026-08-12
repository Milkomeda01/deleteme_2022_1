/* Révélation à l'entrée dans l'écran.

   IntersectionObserver plutôt qu'un calcul de position à chaque image : le
   navigateur fait le travail hors du fil principal, et la page reste fluide
   même avec une centaine d'éléments observés.

   Un élément révélé est retiré de l'observation : une animation d'entrée ne
   se rejoue pas quand on remonte, sinon la page clignote au retour. */

import { $$ } from './utils.js';
import { split } from './split.js';

export function initReveal() {
  // Les titres découpés se comportent comme n'importe quel élément révélé.
  $$('[data-split]').forEach((el) => {
    if (el.hasAttribute('data-split-scrub')) return; // géré par le module Profil
    split(el, el.dataset.split);
  });

  const targets = $$('[data-reveal], [data-split]:not([data-split-scrub])');

  targets.forEach((el) => {
    const delay = el.dataset.revealDelay;
    if (delay) el.style.setProperty('--d', `${delay}ms`);
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    // Le déclenchement se fait un peu avant le bord bas : l'élément est déjà
    // en mouvement quand il devient visible, jamais figé puis animé.
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );

  targets.forEach((el) => io.observe(el));
  return io;
}
