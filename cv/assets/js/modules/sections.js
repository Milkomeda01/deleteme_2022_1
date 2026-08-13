/* Les comportements propres à chaque section. */

import { $, $$, clamp, onTick, onResize, damp, mapRange, prefersReducedMotion } from '../core/utils.js';
import { scroll } from '../core/scroll.js';
import { splitWords } from '../core/split.js';

/* ══ PROFIL — les mots s'allument au fil du défilement ═══════════════════ */

export function initManifesto() {
  const el = $('[data-split-scrub]');
  if (!el) return;

  const words = splitWords(el);
  if (prefersReducedMotion()) { words.forEach((w) => w.classList.add('is-lit')); return; }

  scroll.on(() => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;

    // Le texte s'allume entre 78 % et 32 % de la hauteur d'écran : la
    // lecture se fait donc au milieu de l'écran, pas au ras du bord bas.
    const p = mapRange(r.top, window.innerHeight * 0.78, window.innerHeight * 0.32, 0, 1);
    const lit = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
  });
}

/* ══ RÉSULTATS — compteurs ══════════════════════════════════════════════ */

export function initCounters() {
  const nodes = $$('[data-count]');
  if (!nodes.length) return;

  const fmt = (v, d) =>
    v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const final = (el) => fmt(Number(el.dataset.to), Number(el.dataset.decimals || 0));
  const printing = () => window.matchMedia('print').matches;

  // Les animations en cours, pour pouvoir les interrompre : tant qu'une boucle
  // tourne, elle réécrit la valeur à chaque image et écrase tout le reste.
  const running = new Map();

  // Le HTML contient déjà la valeur finale — on ne la remet donc jamais à zéro
  // en dehors de l'animation elle-même, qui démarre de toute façon près de 0.
  const run = (el) => {
    const to = Number(el.dataset.to);
    const decimals = Number(el.dataset.decimals || 0);
    if (prefersReducedMotion() || printing()) { el.textContent = final(el); return; }

    let t = 0;
    const dur = 1.6;
    const stop = onTick((dt) => {
      t = Math.min(t + dt, dur);
      // Sortie exponentielle : le chiffre part vite et se pose doucement,
      // exactement comme un compteur mécanique qui ralentit.
      const e = 1 - Math.pow(2, -10 * (t / dur));
      el.textContent = fmt(to * e, decimals);
      if (t >= dur) { el.textContent = fmt(to, decimals); running.delete(el); stop(); }
    });
    running.set(el, stop);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      run(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.6 });

  nodes.forEach((n) => io.observe(n));

  /* La feuille d'impression raccourcit brutalement la page : les compteurs
     entrent alors dans le champ et démarrent leur animation, si bien que le
     papier gardait la valeur atteinte à l'instant du Ctrl+P — « 13 M » au
     lieu de « 14 M ». On interrompt donc les boucles en cours, puis on pose
     le résultat. Interrompre d'abord : sinon l'image suivante l'écrase. */
  const settle = () => {
    for (const stop of running.values()) stop();
    running.clear();
    nodes.forEach((el) => { el.textContent = final(el); });
  };
  window.addEventListener('beforeprint', settle);
  window.matchMedia('print').addEventListener('change', (e) => { if (e.matches) settle(); });
}

/* ══ PARCOURS — piste horizontale épinglée ══════════════════════════════ */

export function initTrack() {
  const section = $('[data-track]');
  const rail = $('[data-track-rail]');
  if (!section || !rail) return;

  const wide = window.matchMedia('(min-width: 52.001rem)');
  let distance = 0;
  let current = 0;

  const measure = () => {
    if (!wide.matches || prefersReducedMotion()) {
      section.style.removeProperty('--track-h');
      rail.style.transform = '';
      distance = 0;
      return;
    }
    // Ce qui dépasse de l'écran est exactement ce qu'il faudra parcourir.
    distance = Math.max(0, rail.scrollWidth - window.innerWidth);
    // Un peu de marge après la traversée, pour que la dernière carte ait le
    // temps d'être lue avant que la section ne se décroche.
    section.style.setProperty('--track-h', `${window.innerHeight + distance + window.innerHeight * 0.25}px`);
  };

  measure();
  onResize(measure, 200);
  wide.addEventListener('change', measure);

  scroll.on(() => {
    if (!distance) return;
    const r = section.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;

    // 0 quand la section vient de se coller en haut, 1 quand elle se décroche.
    const p = clamp(-r.top / (section.offsetHeight - window.innerHeight));
    current = p * distance;
    rail.style.transform = `translate3d(${-current}px, 0, 0)`;
  });
}

/* ══ EXPERTISES — accordéon ═════════════════════════════════════════════ */

export function initSkills() {
  const list = $('[data-skills]');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const head = e.target.closest('.skill__head');
    if (!head) return;
    const item = head.closest('.skill');
    const isOpen = item.classList.contains('is-open');

    // Une seule ligne ouverte : la section reste courte et comparable.
    $$('.skill', list).forEach((s) => {
      s.classList.remove('is-open');
      s.querySelector('.skill__head').setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
      item.classList.add('is-open');
      head.setAttribute('aria-expanded', 'true');
    }
  });
}

/* ══ BANDEAU DÉFILANT ═══════════════════════════════════════════════════ */

export function initMarquee() {
  const wrap = $('[data-marquee]');
  const row = $('[data-marquee-row]');
  if (!wrap || !row) return;

  const original = row.innerHTML;
  let unit = 0;

  const build = () => {
    row.innerHTML = original;
    unit = row.scrollWidth;
    if (!unit) return;
    // On duplique jusqu'à couvrir deux fois la fenêtre : la boucle peut
    // alors se recaler sans jamais laisser de vide à droite.
    const copies = Math.ceil((window.innerWidth * 2) / unit);
    for (let i = 0; i < copies; i++) row.insertAdjacentHTML('beforeend', original);
  };

  build();
  onResize(build, 200);

  if (prefersReducedMotion()) return;

  let x = 0;
  let speed = 0;
  onTick((dt) => {
    if (!unit) return;
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;

    // La vitesse de base est constante ; le défilement de la page l'accélère
    // ou la renverse, ce qui rattache le bandeau au geste de l'utilisateur.
    const boost = clamp(Math.abs(scroll.velocity) / 40, 0, 3);
    speed = damp(speed, 60 + boost * 90, 0.08, dt);
    x -= speed * dt * Math.sign(scroll.velocity || 1);
    // Recalage sur la longueur d'un motif : le saut est invisible.
    x = ((x % unit) + unit) % unit;
    row.style.transform = `translate3d(${-x}px, 0, 0)`;
  });
}

/* ══ PARALLAXE SUR LES IMAGES ═══════════════════════════════════════════ */

export function initParallax() {
  const nodes = $$('[data-parallax]');
  if (!nodes.length || prefersReducedMotion()) return;

  const items = nodes.map((el) => ({
    el,
    img: el.querySelector('img') || el.firstElementChild,
    amount: Number(el.dataset.parallax) || 0.08,
  })).filter((it) => it.img);

  scroll.on(() => {
    const vh = window.innerHeight;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      // −1 quand le cadre est en bas de l'écran, +1 quand il en sort par le
      // haut. L'image se déplace donc à contresens de la page, ce qui donne
      // la profondeur — l'agrandissement de 10 % évite d'en découvrir le bord.
      const p = ((r.top + r.height / 2) / vh - 0.5) * -2;
      it.img.style.translate = `0 ${p * it.amount * r.height}px`;
    }
  });
}
