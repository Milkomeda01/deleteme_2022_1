# FLOA Cdiscount - Auto Souscription (extension Chrome)

Extension Chrome (Manifest V3) pour PC. Au clic sur l'icone epinglee, un
popup demande 3 choses, dans l'ordre :

1. **Environnement** : `souscrire` (preprod), `validation-souscrire`, ou
   `souscrire (PRODUCTION)` - un bandeau rouge d'avertissement s'affiche
   dans le popup quand la production est selectionnee.
2. **Produit** : Carte Cdiscount ou Carte Cdiscount CLA.
3. **Identite** (select "identite" du pre-formulaire) : "Moi" (le
   prenom/nom configures dans les Reglages de l'extension) ou "Aleatoire"
   (ce select n'est pas touche).

Une fois "Lancer" clique :

1. Ouvre le pre-formulaire du bon environnement :
   - `souscrire` -> `https://preform-front-prp.floa.com/souscrire`
   - `validation-souscrire` -> `https://preform-front-val.floa.com/souscrire`
   - `prod-souscrire` -> `https://preform-front.floa.com/souscrire`
   (domaines differents, pas juste un chemin qui change)
2. Sur l'environnement validation, un select "environnement" existe AVANT le
   select carte : il est mis sur "validation" automatiquement. Puis la carte
   choisie est selectionnee dans le select suivant, et selon le choix
   d'identite, "Moi" ou rien dans le select d'apres, puis clic sur le bouton
   de soumission ("Poster les donnees").
3. Suit les redirections jusqu'au domaine du formulaire correspondant
   (`preprod-souscrire.floabank.fr`, `validation-souscrire.floabank.fr` ou
   `souscrire.floabank.fr`, quel que soit le chemin exact -
   `/carte-cdiscount/formulaire` ou `/cla-cdiscount/formulaire`) et remplit
   automatiquement chaque etape : Identite (deja pre-remplie), Naissance,
   Foyer, Logement, Profession, Revenus, Charges, Options.

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
son propre prenom/nom : c'est cette valeur qui est cherchee dans le select
"identite" du pre-formulaire quand le choix "Moi" est selectionne dans le
popup. Valeur par defaut : Emile Cartier.

## Utilisation

Cliquer sur l'icone, choisir environnement / produit / identite, puis
"Lancer". Un panneau flottant apparait ensuite en haut a droite de la page du
formulaire et journalise chaque champ rempli (en vert) ou chaque point a
verifier manuellement (en orange). La console du navigateur (F12) contient
le meme journal en detail.

Je n'ai pas pu verifier le libelle exact des options des selects sur le
pre-formulaire : la carte se selectionne par correspondance de texte
("cdiscount" sans "cla" pour la carte classique, "cdiscount" + "cla" pour la
variante CLA), l'environnement par le mot "validation", l'identite par
correspondance sur le prenom/nom configures. Le log indique quelle option a
ete reellement choisie - verifie-la avant que la soumission ne parte.

Les domaines de l'environnement `validation-souscrire`
(`preform-front-val.floa.com` et `validation-souscrire.floabank.fr`) et la
presence d'un select "environnement" supplementaire sont bases sur les
captures d'ecran fournies - a confirmer/adapter dans `background.js`
(`ENVIRONMENTS`) et `content/step1-preform.js` si besoin.

## Limites connues / a verifier

Le formulaire FLOA utilise des web components maison (`ds-selector`,
`ds-select`, `ds-select-search`, ...) dont le fonctionnement interne n'a pas
pu etre teste en direct. Deux champs sont particulierement a risque et
meritent une verification manuelle systematique :

- **Departement de naissance** : corrige (confirme par un retour terrain) -
  `setDropdown` trouve maintenant le vrai `<select>` natif cache dans le
  shadow DOM du composant.
- **Ville de naissance** : corrige - les suggestions sont des
  `<ds-select-search-option>` en DOM clair (enfants directs du champ),
  `pickFirstSuggestion` les cible desormais en priorite et clique la
  1ere de la liste, sans taper de texte.
- **Assurances (Options)** : les clics sur les cartes d'assurance
  (emprunteur / Pack Family Protect) utilisent maintenant une vraie
  sequence d'evenements souris (pointerdown/mousedown/mouseup/click) et
  verifient que l'attribut `checked` est bien applique, avec un 2e essai
  automatique sinon. Le log indique clairement "PAS CONFIRME COCHE" si ca
  echoue malgre tout.

Le champ "Code secret" et le select "OUI/NON" juste apres, dans l'etape
Options, sont volontairement laisses tels quels (voir commentaires dans
`content/step2-formulaire.js`).

## Configuration

Les valeurs a saisir (departement/ville de naissance, situation familiale,
logement, profession, revenus, charges, assurances...) se modifient en tete
du fichier `content/step2-formulaire.js`, dans l'objet `CONFIG`.
