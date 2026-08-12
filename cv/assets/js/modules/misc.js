/* Les petits détails. Pris un par un ils ne valent rien ; ensemble ils font
   la différence entre un gabarit et un site qu'on croit fait sur mesure. */

import { $, $$ } from '../core/utils.js';

/** Heure locale de Bordeaux, quel que soit le fuseau du visiteur : un
 *  recruteur à Montréal voit qu'il est 3 h du matin ici. */
export function initClock(el) {
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Europe/Paris',
  });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
}

export function initYear() {
  const el = $('[data-year]');
  if (el) el.textContent = new Date().getFullYear();
}

/** Copie de l'adresse e-mail, avec retour visible ET annonce vocale. */
export function initCopy() {
  const live = $('[data-live]');

  $$('[data-copy]').forEach((btn) => {
    const span = btn.querySelector('span') || btn;
    const original = span.textContent;

    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Le presse-papiers est refusé hors contexte sécurisé : on retombe
        // sur la sélection manuelle plutôt que d'échouer en silence.
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } catch { /* tant pis */ }
        ta.remove();
      }
      span.textContent = 'Copié ✓';
      if (live) live.textContent = `${text} copié dans le presse-papiers`;
      setTimeout(() => { span.textContent = original; }, 1800);
    });
  });
}

/** « Version imprimable » : la feuille print.css fait tout le travail, il n'y
 *  a donc aucun PDF à maintenir à jour à côté du site. */
export function initPrint() {
  $$('[data-print]').forEach((btn) => btn.addEventListener('click', () => window.print()));
}

