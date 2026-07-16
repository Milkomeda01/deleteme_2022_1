# FLOA Cdiscount - Auto Souscription (extension Chrome)

Extension Chrome (Manifest V3) pour PC. Au clic sur l'icone epinglee, un
petit popup demande quelle carte souscrire : **Carte Cdiscount** ou
**Carte Cdiscount CLA**. Une fois le choix fait :

1. Ouvre `https://preform-front-prp.floa.com/souscrire`.
2. Selectionne la carte choisie dans le 2e `<select>` de la page et
   "Emile Cartier" dans le 3e, puis clique sur le bouton de soumission
   ("Poster les donnees").
3. Suit les redirections jusqu'a
   `https://preprod-souscrire.floabank.fr/carte-cdiscount/formulaire`
   (une "one page" Vue.js) et remplit automatiquement chaque etape :
   Identite (deja pre-remplie), Naissance, Foyer, Logement, Profession,
   Revenus, Charges, Options.

**L'extension s'arrete volontairement apres avoir rempli l'etape Options.**
Elle ne clique jamais sur le bouton qui menerait a l'etape de Signature, afin
de ne jamais soumettre le dossier a la banque.

## Installation (mode developpeur)

1. Ouvrir `chrome://extensions`.
2. Activer le "Mode developpeur" (en haut a droite).
3. Cliquer "Charger l'extension non empaquetee" et choisir ce dossier.
4. Epingler l'extension dans la barre d'outils Chrome.

## Utilisation

Cliquer sur l'icone de l'extension, choisir "Carte Cdiscount" ou "Carte
Cdiscount CLA" dans le popup. Un panneau flottant apparait ensuite en haut a
droite de la page du formulaire et journalise chaque champ rempli (en vert)
ou chaque point a verifier manuellement (en orange). La console du
navigateur (F12) contient le meme journal en detail.

Je n'ai pas pu verifier le libelle exact des options du select "carte" sur
le pre-formulaire : la selection se fait par correspondance de texte
("cdiscount" sans "cla" pour la carte classique, "cdiscount" + "cla" pour la
variante CLA). Le log indique quelle option a ete reellement choisie -
verifie-la avant que la soumission ne parte.

## Limites connues / a verifier

Le formulaire FLOA utilise des web components maison (`ds-selector`,
`ds-select`, `ds-select-search`, ...) dont le fonctionnement interne n'a pas
pu etre teste en direct. Deux champs sont particulierement a risque et
meritent une verification manuelle systematique :

- **Ville de naissance** (champ de recherche/autocompletion) : peut ne pas
  se remplir automatiquement selon le comportement exact du composant.
- **Departement / Profession** (listes deroulantes personnalisees) :
  remplies via plusieurs strategies de secours, a verifier visuellement.

Le champ "Code secret" et le select "OUI/NON" juste apres, dans l'etape
Options, sont volontairement laisses tels quels (voir commentaires dans
`content/step2-formulaire.js`).

## Configuration

Les valeurs a saisir (departement/ville de naissance, situation familiale,
logement, profession, revenus, charges, assurances...) se modifient en tete
du fichier `content/step2-formulaire.js`, dans l'objet `CONFIG`.
