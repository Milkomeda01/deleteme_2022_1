/* Écran de chargement.

   Un compteur qui ment est le pire cliché du genre : ici la barre plafonne
   à 92 % tant que les polices et les ressources ne sont pas réellement
   prêtes, puis termine sa course. On garde tout de même une durée minimale,
   parce qu'un voile qui disparaît en 80 ms ressemble à un bug d'affichage.

   La promesse renvoyée résout quand le voile est levé : c'est le signal de
   départ de toutes les autres animations. */

import { onTick, clamp, prefersReducedMotion } from '../core/utils.js';

const MIN_DURATION = 1.1;  // secondes
const MAX_DURATION = 4;

export function initLoader(el) {
  if (!el) return Promise.resolve();

  const bar = el.querySelector('[data-loader-bar]');
  const count = el.querySelector('[data-loader-count]');
  document.body.classList.add('is-locked');

  const finish = () => {
    el.classList.add('is-done');
    document.body.classList.remove('is-locked');
    // Retiré du DOM une fois le rideau parti : un élément plein écran en
    // `position: fixed` qui reste là coûte une couche de composition.
    setTimeout(() => el.remove(), 1200);
  };

  if (prefersReducedMotion()) { finish(); return Promise.resolve(); }

  let ready = false;
  Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((res) => {
      if (document.readyState === 'complete') res();
      else window.addEventListener('load', res, { once: true });
    }),
  ]).then(() => { ready = true; });

  return new Promise((resolve) => {
    let value = 0;
    let elapsed = 0;

    const stop = onTick((dt) => {
      elapsed += dt;
      if (elapsed > MAX_DURATION) ready = true;   // filet de sécurité

      const ceiling = ready ? 100 : 92;
      // Vitesse dégressive : rapide au début, elle s'assied vers la fin.
      const speed = (ceiling - value) * (ready ? 5.5 : 1.6);
      value = clamp(value + speed * dt, 0, 100);

      if (elapsed < MIN_DURATION) value = Math.min(value, 92);

      count.textContent = Math.round(value);
      bar.style.scale = `${value / 100} 1`;

      if (value > 99.5 && elapsed >= MIN_DURATION) {
        count.textContent = '100';
        bar.style.scale = '1 1';
        stop();
        setTimeout(() => { finish(); resolve(); }, 260);
      }
    });
  });
}
