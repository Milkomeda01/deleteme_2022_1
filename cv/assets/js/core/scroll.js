/* ══════════════════════════════════════════════════════════════════════════
   DÉFILEMENT DOUX
   ══════════════════════════════════════════════════════════════════════════
   On ne déplace PAS la page avec un `transform` : on continue d'utiliser le
   défilement natif, simplement lissé. La position réelle du document reste
   donc juste, ce qui préserve `position: sticky`, la barre de défilement, la
   recherche dans la page, les ancres et les lecteurs d'écran. C'est la seule
   implémentation qui ne casse rien.

   Elle se désactive d'elle-même au tactile (l'inertie native est meilleure)
   et si l'utilisateur demande un mouvement réduit.
   ══════════════════════════════════════════════════════════════════════════ */

import { clamp, damp, onTick, prefersReducedMotion, isCoarsePointer } from './utils.js';

class Scroll {
  constructor() {
    this.enabled = !prefersReducedMotion() && !isCoarsePointer();
    this.y = window.scrollY;
    this.target = this.y;
    this.velocity = 0;
    this.max = 0;
    this._lastApplied = this.y;
    this._listeners = new Set();

    this.measure();
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this.measure, { passive: true });

    if (this.enabled) {
      window.addEventListener('wheel', this._onWheel, { passive: false });
      document.documentElement.style.scrollBehavior = 'auto';
    }

    onTick(this._tick);
  }

  measure = () => {
    this.max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  };

  /** Toute position venue d'ailleurs (clavier, barre, ancre, molette de
   *  souris libre) doit reprendre la main sur notre cible interpolée. */
  _onScroll = () => {
    if (!this.enabled) { this.y = window.scrollY; return; }
    if (Math.abs(window.scrollY - this._lastApplied) > 2) {
      this.y = this.target = window.scrollY;
    }
  };

  _onWheel = (e) => {
    if (e.ctrlKey) return;                 // zoom navigateur : on ne touche pas
    if (e.target.closest?.('[data-native-scroll]')) return;
    e.preventDefault();
    // Les modes « ligne » et « page » n'ont pas la même unité que « pixel ».
    const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? window.innerHeight : 1;
    this.target = clamp(this.target + e.deltaY * unit, 0, this.max);
  };

  _tick = (dt) => {
    if (!this.enabled) {
      const y = window.scrollY;
      this.velocity = y - this.y;
      this.y = y;
      this._emit();
      return;
    }
    const next = damp(this.y, this.target, 0.12, dt);
    this.velocity = next - this.y;
    this.y = next;

    // Sous le demi-pixel, on arrête d'écrire : inutile, et ça empêche le
    // navigateur de considérer le défilement comme terminé.
    if (Math.abs(this.target - this.y) > 0.4) {
      this._lastApplied = this.y;
      window.scrollTo(0, this.y);
    }
    this._emit();
  };

  _emit() { for (const fn of this._listeners) fn(this); }

  /** S'abonner à chaque image de défilement. Renvoie la fonction de retrait. */
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  /** Aller à une position ou à un élément, en gardant l'inertie du site. */
  to(target, { offset = 0, immediate = false } = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const y = typeof target === 'number'
      ? target
      : el ? window.scrollY + el.getBoundingClientRect().top + offset : this.target;

    const dest = clamp(y, 0, this.max);
    if (!this.enabled || immediate) {
      window.scrollTo({ top: dest, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      this.y = this.target = dest;
      return;
    }
    this.target = dest;
  }

  /** Avancement 0→1 d'un élément qui traverse la fenêtre.
   *  `start`/`end` sont exprimés en fractions de hauteur de fenêtre. */
  progress(el, start = 1, end = 0) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = r.height + vh * (start - end);
    if (total <= 0) return 0;
    return clamp((vh * start - r.top) / total);
  }
}

export const scroll = new Scroll();
