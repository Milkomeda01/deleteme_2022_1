# FLOA Cdiscount - Auto Souscription (extension Chrome)

Extension Chrome (Manifest V3) pour PC. Au clic sur l'icone epinglee, un
popup demande 3 choses, dans l'ordre :

1. **Environnement** : `souscrire` ou `validation-souscrire`.
2. **Produit** : Carte Cdiscount ou Carte Cdiscount CLA.
3. **Identite** (select 3 du pre-formulaire) : "Moi" (le prenom/nom
   configures dans les Reglages de l'extension) ou "Aleatoire" (le select 3
   n'est pas touche).

Une fois "Lancer" clique :

1. Ouvre `https://preform-front-prp.floa.com/{souscrire|validation-souscrire}`.
2. Selectionne la carte choisie dans le 2e `<select>` de la page, et selon le
   choix d'identite, "Moi" ou rien dans le 3e, puis clique sur le bouton de
   soumission ("Poster les donnees").
3. Suit les redirections jusqu'a `preprod-souscrire.floabank.fr` (une "one
   page" Vue.js, quel que soit le chemin exact) et remplit automatiquement
   chaque etape : Identite (deja pre-remplie), Naissance, Foyer, Logement,
   Profession, Revenus, Charges, Options.

**L'extension s'arrete volontairement apres avoir rempli l'etape Options.**
Elle ne clique jamais sur le bouton qui menerait a l'etape de Signature, afin
de ne jamais soumettre le dossier a la banque.

## Installation (mode developpeur)

1. Ouvrir `chrome://extensions`.
2. Activer le "Mode developpeur" (en haut a droite).
3. Cliquer "Charger l'extension non empaquetee" et choisir ce dossier.
4. Epingler l'extension dans la barre d'outils Chrome.

## Reglages (identite "Moi")

Clic sur l'icone -> "⚙️ Reglages (mon prenom/nom)" (ou clic droit sur
l'icone -> "Options"). Chaque personne qui utilise l'extension y renseigne
son propre prenom/nom : c'est cette valeur qui est cherchee dans le select 3
du pre-formulaire quand le choix "Moi" est selectionne dans le popup. Valeur
par defaut : Emile Cartier.

## Utilisation

Cliquer sur l'icone, choisir environnement / produit / identite, puis
"Lancer". Un panneau flottant apparait ensuite en haut a droite de la page du
formulaire et journalise chaque champ rempli (en vert) ou chaque point a
verifier manuellement (en orange). La console du navigateur (F12) contient
le meme journal en detail.

Je n'ai pas pu verifier le libelle exact des options des selects 2/3 sur le
pre-formulaire : la carte se selectionne par correspondance de texte
("cdiscount" sans "cla" pour la carte classique, "cdiscount" + "cla" pour la
variante CLA), l'identite par correspondance sur le prenom/nom configures.
Le log indique quelle option a ete reellement choisie - verifie-la avant que
la soumission ne parte.

Le chemin `/validation-souscrire` est une supposition (meme nom d'hote que
`/souscrire`, juste le chemin qui change) - a confirmer/adapter dans
`background.js` (`ENVIRONMENT_PATHS`) si ce n'est pas le bon.

## Limites connues / a verifier

Le formulaire FLOA utilise des web components maison (`ds-selector`,
`ds-select`, `ds-select-search`, ...) dont le fonctionnement interne n'a pas
pu etre teste en direct. Deux champs sont particulierement a risque et
meritent une verification manuelle systematique :

- **Ville de naissance** (champ de recherche/autocompletion) : peut ne pas
  se remplir automatiquement selon le comportement exact du composant.
- **Departement / Profession** (listes deroulantes personnalisees) :
  remplies via plusieurs strategies de secours (valeur directe, clic sur
  l'option affichee, navigation clavier), a verifier visuellement - un
  premier retour terrain a montre que le departement ne se remplissait pas
  correctement, voir les strategies de secours ajoutees dans
  `content/step2-formulaire.js` (`setDropdown`).

Le champ "Code secret" et le select "OUI/NON" juste apres, dans l'etape
Options, sont volontairement laisses tels quels (voir commentaires dans
`content/step2-formulaire.js`).

## Configuration

Les valeurs a saisir (departement/ville de naissance, situation familiale,
logement, profession, revenus, charges, assurances...) se modifient en tete
du fichier `content/step2-formulaire.js`, dans l'objet `CONFIG`.
