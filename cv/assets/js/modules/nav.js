/* Barre supérieure, menu plein écran, fil de progression, bascule de thème.

   Tout ce qui suit se met à jour depuis l'abonnement unique au défilement :
   aucune de ces fonctions ne déclenche de mesure de mise en page pendant le
   défilement, hormis un `getBoundingClientRect` par section, qui est bon
   marché et non bloquant tant qu'on n'écrit rien juste avant. */

import { $, $$, clamp } from '../core/utils.js';
import { scroll } from '../core/scroll.js';

export function initNav() {
  const topbar = $('[data-topbar]');
  const toggle = $('[data-menu-toggle]');
  const burgerLabel = $('[data-burger-label]');
  const menu = $('#menu');
  const bar = $('[data-progress-bar]');
  const indexEl = $('[data-progress-index]');
  const links = $$('[data-nav-link]');
  const sections = $$('[data-section]');

  /* ── Menu ─────────────────────────────────────────────────────────────── */

  $$('.menu__nav a').forEach((a, i) => a.style.setProperty('--i', i));

  let open = false;
  let lastFocused = null;

  const setMenu = (next) => {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    burgerLabel.textContent = open ? 'Fermer' : 'Menu';
    document.body.classList.toggle('is-locked', open);
    document.body.classList.toggle('menu-open', open);

    if (open) {
      lastFocused = document.activeElement;
      menu.hidden = false;
      // Un cadre d'attente : sans lui, la transition part de l'état final,
      // parce que l'élément vient tout juste de quitter `hidden`.
      requestAnimationFrame(() => menu.classList.add('is-open'));
      menu.querySelector('a')?.focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!open) menu.hidden = true; }, 800);
      lastFocused?.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => setMenu(!open));

  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    if (e.key !== 'Tab') return;
    // Piège à focus : tant que le menu est ouvert, la tabulation ne doit pas
    // partir dans la page qui se trouve dessous.
    const items = $$('a, button', menu).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ── Liens de défilement ──────────────────────────────────────────────── */

  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('[data-scroll-to]');
    if (!link) return;
    const id = link.getAttribute('href') || link.dataset.target;
    if (!id?.startsWith('#')) return;
    const dest = document.querySelector(id);
    if (!dest) return;

    e.preventDefault();
    if (open) setMenu(false);
    scroll.to(dest);
    // L'ancre reste dans l'URL : le lien est partageable et le retour arrière
    // fonctionne, ce que casse la plupart des défilements personnalisés.
    history.replaceState(null, '', id);
  });

  /* ── Barre qui se rétracte ────────────────────────────────────────────── */

  let lastY = scroll.y;
  let lastSection = sections[0] || null;
  const onScrollFrame = () => {
    const y = scroll.y;
    const down = y > lastY;
    // On ne masque qu'après le premier écran : en haut de page, la barre
    // fait partie de la composition.
    topbar.classList.toggle('is-hidden', down && y > window.innerHeight * 0.9 && !open);
    topbar.classList.toggle('is-stuck', y > 40);
    lastY = y;

    /* ── Progression ────────────────────────────────────────────────────── */
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    bar.style.scale = `${clamp(y / max)} 1`;

    /* ── Section courante : thème, numéro, lien actif ───────────────────── */
    // La section « courante » est celle qui occupe le milieu de l'écran.
    // Si aucune ne le fait (marge entre deux blocs), on garde la précédente :
    // repartir sur la première ferait clignoter le thème en plein défilement.
    const mid = window.innerHeight * 0.5;
    let current = null;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { current = s; break; }
    }
    if (!current) current = lastSection;
    if (!current) return;
    lastSection = current;

    const theme = current.dataset.theme || 'dark';
    if (document.body.dataset.theme !== theme) document.body.dataset.theme = theme;

    const idx = current.dataset.index;
    if (idx && indexEl.textContent !== idx) indexEl.textContent = idx;

    const id = `#${current.id}`;
    links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === id));
  };

  scroll.on(onScrollFrame);
  onScrollFrame();
}
