/* Découpe un texte en lettres ou en mots, chacun dans son propre masque.
   Le fragment est traduit sous le masque puis remonte : l'effet « le texte
   sort du papier » que l'on voit sur les titres.

   Deux précautions qui font la différence :
   — le texte original est conservé pour les lecteurs d'écran (aria-label),
     sinon la synthèse vocale épellera les lettres une à une ;
   — on ne découpe jamais les espaces insécables, pour ne pas casser la
     typographie française (« Travaillons ensemble » reste soudé). */

export function split(el, mode = 'chars') {
  if (el.dataset.splitDone) return [];
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', source);
  el.dataset.splitDone = '1';

  const pieces = mode === 'words' ? source.split(' ') : Array.from(source);
  const frag = document.createDocumentFragment();
  const items = [];

  pieces.forEach((piece, i) => {
    if (piece === ' ') { frag.append(' '); return; }

    const mask = document.createElement('span');
    mask.className = 'split';
    mask.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('span');
    inner.className = 'split__i';
    inner.textContent = piece;
    // Le décalage progressif est ce qui donne le mouvement « en vague ».
    inner.style.setProperty('--d', `${i * (mode === 'words' ? 45 : 26)}ms`);

    mask.append(inner);
    frag.append(mask);
    if (mode === 'words' && i < pieces.length - 1) frag.append(' ');
    items.push(inner);
  });

  el.textContent = '';
  el.append(frag);
  return items;
}

/** Variante sans masque : chaque mot reste un <span> que l'on peut colorer
 *  au fil du défilement (section « Profil »). */
export function splitWords(el) {
  if (el.dataset.splitDone) return [];
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', source);
  el.dataset.splitDone = '1';

  const frag = document.createDocumentFragment();
  const words = [];
  source.split(' ').forEach((w, i, arr) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = w;
    frag.append(span);
    if (i < arr.length - 1) frag.append(' ');
    words.push(span);
  });
  el.textContent = '';
  el.append(frag);
  return words;
}
