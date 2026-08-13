/* ══════════════════════════════════════════════════════════════════════════
   LE PLONGEON — section « Hors écran »
   ══════════════════════════════════════════════════════════════════════════
   Cinq ans de plongeon acrobatique écrits dans une liste ne disent rien.
   Joués, ils se comprennent en dix secondes : on s'élance, on groupe pour
   tourner vite, on ouvre pour freiner, et on entre dans l'eau le plus droit
   possible. Le geste EST l'argument.

   La physique est réelle, pas simulée à vue : le moment cinétique se
   conserve, donc grouper réduit le moment d'inertie et accélère la rotation.
   C'est ce qui rend le jeu jouable plutôt qu'aléatoire — et c'est ce qui
   fait que quelqu'un qui a plongé le reconnaît tout de suite.

   Canvas 2D, pas de moteur physique, pas d'images. Le contenu de la section
   reste lisible et complet sans jamais lancer le jeu.
   ══════════════════════════════════════════════════════════════════════════ */

import { onTick, onResize, clamp, prefersReducedMotion } from '../core/utils.js';

const TAU = Math.PI * 2;

/** Écart angulaire signé le plus court entre deux angles. */
const angleDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export function initDive(root) {
  if (!root) return;

  const canvas = root.querySelector('[data-dive-canvas]');
  const noteEl = root.querySelector('[data-dive-note]');
  const detailEl = root.querySelector('[data-dive-detail]');
  const bestEl = root.querySelector('[data-dive-best]');
  const hintEl = root.querySelector('[data-dive-hint]');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let W = 0, H = 0;
  let ink = '#edebe6', accent = '#d8b26a', dim = '#8b90a0';

  /* ── Repères du plateau ───────────────────────────────────────────────── */
  /* Le plongeoir est bas dans le cadre, pas en haut : l'impulsion fait monter
     le plongeur de ~0,28 hauteur de canvas, et depuis le haut il sortait
     du cadre pendant une demi-seconde. */
  const board = () => ({ x: W * 0.16, y: H * 0.34 });
  const waterY = () => H * 0.80;

  const s = {
    phase: 'idle',        // idle · air · done
    x: 0, y: 0, vx: 0, vy: 0,
    angle: 0, angle0: 0,  // 0 = debout, π = tête en bas
    momentum: 0,          // moment cinétique, constant pendant le vol
    tuck: 0,              // 0 = corps tendu, 1 = groupé
    holding: false,
    trail: [],
    drops: [],
    best: null,
    idle: 0,
  };

  /* ── Mise à l'échelle ─────────────────────────────────────────────────── */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Les couleurs viennent des tokens : le jeu suit le thème de la page.
    const cs = getComputedStyle(root);
    ink = cs.getPropertyValue('--fg').trim() || ink;
    accent = cs.getPropertyValue('--accent').trim() || accent;
    dim = cs.getPropertyValue('--fg-dim').trim() || dim;

    if (s.phase === 'idle') reset();
  }

  function reset() {
    const b = board();
    s.phase = 'idle';
    s.x = b.x; s.y = b.y;
    s.vx = 0; s.vy = 0;
    s.angle = 0; s.angle0 = 0;
    s.momentum = 0; s.tuck = 0;
    s.trail.length = 0;
    s.drops.length = 0;
  }

  /* ── Départ ───────────────────────────────────────────────────────────── */
  function launch() {
    if (s.phase === 'air') return;
    reset();
    s.phase = 'air';
    s.vx = W * 0.17;
    s.vy = -H * 0.95;
    /* Le moment cinétique est donné à l'impulsion et ne change plus : seul le
       groupé fera varier la vitesse de rotation.

       La valeur n'est pas choisie au hasard. Le vol dure ~1,65 s ; corps
       tendu, 1,90 rad/s font exactement un demi-tour — soit le plongeon
       droit, tête la première, note maximale pour qui ne touche à rien
       après l'impulsion. Groupé à fond on atteint ~1,8 tour, ce qui met le
       salto et demi à portée sans le rendre automatique. Deux entrées
       propres possibles, l'une facile, l'autre à mériter. */
    s.momentum = 2.0;
    s.angle0 = 0;
    hintEl.textContent = 'Maintenez pour grouper, relâchez pour ouvrir';
  }

  function judge() {
    // Entrée idéale : tête la première, corps vertical → angle = π.
    const dev = Math.abs(angleDiff(s.angle, Math.PI)) * (180 / Math.PI);
    const turns = Math.abs(s.angle - s.angle0) / TAU;
    const halves = Math.round(turns * 2) / 2;

    const note = clamp(10 - dev / 9, 0, 10);
    // Coefficient de difficulté, comme en compétition : plus de saltos, plus
    // le plongeon vaut cher — mais l'entrée devient beaucoup plus dure.
    const dd = 1 + 0.3 * halves;
    const total = note * dd;

    noteEl.textContent = total.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const saltos = halves <= 0.5 ? 'plongeon droit'
      : `${halves.toLocaleString('fr-FR')} salto${halves > 1 ? 's' : ''}`;
    detailEl.textContent = `${saltos} · entrée à ${Math.round(dev)}° · note ${note.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} × ${dd.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;

    if (s.best === null || total > s.best) {
      s.best = total;
      bestEl.textContent = total.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    hintEl.textContent = 'Relancez quand vous voulez';

    // Gerbe d'eau : la seule fantaisie du tableau, et elle est méritée.
    for (let i = 0; i < 18; i++) {
      s.drops.push({
        x: s.x, y: waterY(),
        vx: (Math.random() - 0.5) * W * 0.30,
        vy: -Math.random() * H * 0.42 - H * 0.06,
        life: 1,
      });
    }
  }

  /* ── Simulation ───────────────────────────────────────────────────────── */
  function step(dt) {
    if (s.phase === 'air') {
      const g = H * 1.6;
      s.vy += g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Groupé : le moment d'inertie chute, donc la rotation s'accélère.
      s.tuck += ((s.holding ? 1 : 0) - s.tuck) * Math.min(1, dt * 9);
      const inertia = 1 - 0.72 * s.tuck;
      s.angle += (s.momentum / inertia) * dt;

      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 90) s.trail.shift();

      if (s.y >= waterY()) { s.y = waterY(); s.phase = 'done'; judge(); }
    }

    for (let i = s.drops.length - 1; i >= 0; i--) {
      const d = s.drops[i];
      d.vy += H * 2.2 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt * 1.1;
      if (d.life <= 0 || d.y > H) s.drops.splice(i, 1);
    }

    if (s.phase === 'idle') s.idle += dt;
  }

  /* ── Rendu ────────────────────────────────────────────────────────────── */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const wy = waterY();
    const b = board();

    // Graduations : l'échelle de mesure, en rappel de la trajectographie.
    ctx.strokeStyle = dim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = b.y + ((wy - b.y) * i) / 10;
      const long = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(W - 10, y);
      ctx.lineTo(W - (long ? 26 : 17), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // L'eau
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, wy, W, H - wy);
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, wy);
    ctx.lineTo(W, wy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Le plongeoir
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - W * 0.11, b.y + 9);
    ctx.lineTo(b.x + 10, b.y + 9);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x - W * 0.09, b.y + 9);
    ctx.lineTo(b.x - W * 0.09, wy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // La trajectoire, tracée derrière le plongeur
    if (s.trail.length > 1) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.trail[0].x, s.trail[0].y);
      for (const p of s.trail) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let i = 0; i < s.trail.length; i += 9) {
        ctx.fillStyle = accent;
        ctx.fillRect(s.trail[i].x - 1.5, s.trail[i].y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
    }

    // Les gouttes
    ctx.fillStyle = accent;
    for (const d of s.drops) {
      ctx.globalAlpha = clamp(d.life, 0, 1);
      ctx.fillRect(d.x - 1.5, d.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Le plongeur : un trait qui se raccourcit en se groupant, une tête.
    if (s.phase !== 'done' || s.drops.length) {
      const len = H * 0.11 * (1 - 0.58 * s.tuck);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = ink;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4 + 4 * s.tuck;
      // Un halo léger le détache de l'eau et du fond.
      ctx.shadowColor = ink;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -len / 2);
      ctx.lineTo(0, len / 2);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, -len / 2 - 5, 5.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // Invite à jouer, tant que rien n'a été lancé
    if (s.phase === 'idle') {
      ctx.globalAlpha = 0.7 + Math.sin(s.idle * 2.2) * 0.3;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ── Entrées ──────────────────────────────────────────────────────────── */
  const press = () => {
    if (s.phase === 'air') { s.holding = true; return; }
    launch();
    s.holding = true;
  };
  const release = () => { s.holding = false; };

  canvas.addEventListener('pointerdown', press);
  window.addEventListener('pointerup', release);
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();          // sinon la barre d'espace fait défiler la page
    if (!e.repeat) press();
  });
  canvas.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });

  /* ── Boucle ───────────────────────────────────────────────────────────── */
  resize();
  onResize(resize, 200);

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 })
    .observe(canvas);

  const still = prefersReducedMotion();
  draw();

  onTick((dt) => {
    // Rien ne tourne tant que la section n'est pas à l'écran ; et en mouvement
    // réduit, on ne dessine que pendant un plongeon réellement demandé.
    if (!visible || document.hidden) return;
    if (still && s.phase === 'idle' && !s.drops.length) return;
    step(Math.min(dt, 0.033));
    draw();
  });
}
