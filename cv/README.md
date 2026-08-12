# CV — site animé

Un CV en une page, pensé pour tenir devant un jury de prix (Awwwards & co.)
**et** devant un recruteur pressé. Sombre, cinématique, fond WebGL, parcours
en défilement horizontal, et une feuille d'impression qui redonne un vrai
document A4 sans qu'il y ait de PDF à maintenir à côté.

Aucune dépendance, aucune étape de compilation : du HTML, du CSS et du
JavaScript natif. Ce dossier est le site.

---

## Démarrer

Les modules ES ne se chargent pas depuis `file://`. Il faut un serveur, même
minimal :

```bash
cd cv
python3 -m http.server 8000     # puis http://localhost:8000
```

## Mettre son propre contenu

Tout le texte est dans `index.html`, repéré par le signe **✎**. Cherchez-le
dans le fichier : chaque bloc marqué est un endroit à remplir.

| À changer | Où |
| --- | --- |
| Titre, description, URL, image de partage | `<head>`, bloc ✎ MÉTA |
| Nom, poste, phrase d'accroche | section `#intro` |
| Pitch, axe de positionnement, fiche signalétique | `#manifeste` |
| Les quatre chiffres | `#chiffres` — `data-to` = valeur finale du compteur |
| Les expériences | `#parcours` — un `<li class="job">` par poste, la piste s'allonge seule |
| Les expertises | `#expertises` |
| Les trois études de cas | `#projets` |
| Formation, langues, outils | `#formation` |
| Adresse, téléphone, réseaux | `#contact` et le menu |

Deux détails à ne pas oublier :

- dans `#contact`, l'attribut `data-alt` d'un lien doit reprendre **le même
  texte** que le lien : c'est le libellé qui remonte au survol ;
- le bandeau `[data-demo]` (« contenu de démonstration ») **doit être
  supprimé** une fois le vrai contenu en place, ainsi que la règle `.demo`
  dans `assets/css/base.css`.

### L'axe de positionnement

Le bloc `.axis` de la section Profil place un curseur entre « métier &
marketing » et « technique & développement ». Il part du côté gauche et vient
se poser au milieu quand la section entre à l'écran — c'est la réponse en une
image à la première question d'un recruteur devant un profil de chef de
projet : « plutôt fonctionnel ou plutôt technique ? »

Pour décaler le curseur, il suffit de changer `left: 50%` dans la règle
`.axis.is-in .axis__dot` (`assets/css/sections.css`).

### Changer la direction artistique

Couleurs, polices, échelle typographique, durées et courbes d'animation sont
tous dans `assets/css/tokens.css`. C'est le seul fichier à toucher pour
changer l'ambiance ; rien n'est codé en dur ailleurs.

Pour repeindre le fond animé, les trois couleurs sont dans le shader, en haut
de `assets/js/modules/gl.js` (`deep`, `blue`, `gold`).

## Structure

```
index.html                  toute la page et tout le contenu
assets/css/tokens.css       couleurs, typo, rythme, courbes  ← la DA vit ici
assets/css/base.css         remise à zéro, châssis (curseur, menu, chargement)
assets/css/sections.css     une section = un bloc de règles
assets/css/print.css        la version papier / PDF
assets/js/core/utils.js     lerp, clamp, boucle d'animation unique
assets/js/core/scroll.js    défilement doux (natif, seulement lissé)
assets/js/core/split.js     découpe des titres en lettres / mots
assets/js/core/reveal.js    révélations à l'entrée dans l'écran
assets/js/modules/gl.js     fond WebGL du premier écran
assets/js/modules/loader.js écran de chargement
assets/js/modules/cursor.js curseur personnalisé + effet magnétique
assets/js/modules/nav.js    barre, menu, progression, bascule de thème
assets/js/modules/sections.js  profil, compteurs, piste horizontale, bandeau
assets/js/modules/misc.js   horloge, copie d'adresse, impression
assets/fonts/               Cormorant Garamond + Inter, auto-hébergées
```

## Les partis pris

**Le défilement doux ne déplace pas la page.** Il lisse le défilement natif
(`window.scrollTo` interpolé) au lieu de translater un conteneur. La position
réelle du document reste donc juste : `position: sticky`, la barre de
défilement, la recherche dans la page, les ancres et les lecteurs d'écran
continuent de fonctionner. Il se désactive tout seul au tactile, où l'inertie
du système fait mieux.

**Une seule boucle `requestAnimationFrame`** pour tout le site
(`core/utils.js`). Une boucle par module est la première cause de saccade sur
ce type de page.

**Le HTML est complet sans JavaScript.** Le JS n'ajoute que du mouvement. Un
navigateur bridé, un robot d'indexation ou un ATS voit l'intégralité du CV.

**`prefers-reduced-motion` est respecté partout** : plus de voile de
chargement, plus de curseur personnalisé, plus de grain, plus de piste
horizontale — le contenu reste entier et immobile. C'est le premier critère
d'accessibilité regardé sur un site très animé.

**Le fond WebGL est bridé** : rendu à 55 % de la résolution écran, mis en
pause dès qu'il sort du champ, et si le contexte est refusé la page retombe
en silence sur son dégradé CSS.

**Ctrl+P donne un CV.** `print.css` remet la piste horizontale à plat, déplie
les expertises, repasse tout en noir sur blanc et supprime le châssis. Le
bouton « Version imprimable » ne fait qu'appeler `window.print()` : il n'y a
donc jamais de PDF périmé à côté du site.

## Mise en ligne

Site statique : le dossier `cv/` se publie tel quel.

- **Cloudflare Pages** — répertoire de sortie `cv`, aucune commande de build.
- **GitHub Pages** — publier le dossier, ou copier son contenu à la racine
  de la branche de publication.
- **Netlify / Vercel** — glisser-déposer du dossier, sans configuration.

Avant de publier : remplacer les URL `https://emilecartier.fr/` du `<head>`,
fournir `assets/img/og.jpg` (1200×630) pour l'aperçu des partages, et
supprimer le bandeau de démonstration.

## Vérifié sur

Chromium 1440×900 et 390×844, en mouvement réduit, sans JavaScript, au
clavier seul, et en rendu papier A4. Aucune erreur console.
