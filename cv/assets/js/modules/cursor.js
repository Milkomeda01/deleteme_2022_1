/* Curseur personnalisé + effet magnétique.

   Deux règles pour que ce ne soit pas une nuisance :
   — au pointeur grossier (doigt, stylet) ou en mouvement réduit, on ne
     remplace rien du tout, le curseur système reste maître ;
   — le curseur natif n'est jamais masqué globalement ; il l'est seulement
     sur les zones où le nôtre le remplace vraiment. Une page où l'on perd
     son pointeur est une page qu'on quitte. */

import { onTick, damp, isCoarsePointer, prefersReducedMotion, $$ } from '../core/utils.js';

export function initCursor(root) {
  if (!root || isCoarsePointer() || prefersReducedMotion()) return;

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const label = root.querySelector('[data-cursor-label]');

  const pos = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  let visible = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pos.x = e.clientX; pos.y = e.clientY;
    if (!visible) { visible = true; root.classList.add('is-active'); }
  }, { passive: true });

  document.addEventListener('pointerleave', () => root.classList.remove('is-active'));
  document.addEventListener('pointerenter', () => root.classList.add('is-active'));

  onTick((dt) => {
    // Le point colle au pointeur, l'anneau traîne : cet écart est tout
    // l'effet. S'ils bougent ensemble, on ne voit qu'un gros curseur.
    dot.style.translate = `${pos.x}px ${pos.y}px`;
    pos.rx = damp(pos.rx, pos.x, 0.18, dt);
    pos.ry = damp(pos.ry, pos.y, 0.18, dt);
    ring.style.translate = `${pos.rx}px ${pos.ry}px`;
  });

  // Cibles « interactives » : l'anneau grossit et peut afficher un mot.
  const hoverables = 'a, button, [data-magnetic], [data-cursor-text], .skill__head';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.(hoverables);
    if (!t) return;
    root.classList.add('is-hover');
    label.textContent = t.dataset.cursorText || '';
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest?.(hoverables)) {
      root.classList.remove('is-hover');
      label.textContent = '';
    }
  });
}

/* Attraction magnétique : l'élément se déplace vers le pointeur quand il
   approche. Le déplacement est plafonné, sinon le bouton fuit sous le clic. */
export function initMagnetic() {
  if (isCoarsePointer() || prefersReducedMotion()) return;

  $$('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.32;
    const state = { x: 0, y: 0, tx: 0, ty: 0, active: false };

    el.addEventListener('pointerenter', () => { state.active = true; });
    el.addEventListener('pointerleave', () => {
      state.active = false; state.tx = 0; state.ty = 0;
    });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      state.tx = (e.clientX - (r.left + r.width / 2)) * strength;
      state.ty = (e.clientY - (r.top + r.height / 2)) * strength;
    });

    onTick((dt) => {
      if (!state.active && Math.abs(state.x) < 0.05 && Math.abs(state.y) < 0.05) return;
      state.x = damp(state.x, state.tx, 0.18, dt);
      state.y = damp(state.y, state.ty, 0.18, dt);
      el.style.translate = `${state.x}px ${state.y}px`;
    });
  });
}
