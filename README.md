# deniscartierarchitecte.fr

Site de Denis Cartier, architecte DPLG à Bordeaux. Site statique **Astro**,
hébergé sur **Cloudflare Pages** (gratuit), formulaire de contact traité par un
**Worker maison** avec archivage en base **D1**.

Il remplace le site précédent (CMS Jalis, 400 €/mois) en conservant le contenu,
les photographies et le référencement.

---

## Démarrer

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # génère dist/ (+ régénère public/_redirects)
npm run preview  # sert le build
npm run check    # vérification TypeScript
```

## Aperçu en ligne

Un site de test public est déployé à chaque poussée sur `main` :
**https://milkomeda01.github.io/deleteme_2022_1/**

Il est en `noindex` : Google ne l'indexera pas, et il ne fera donc jamais
doublon avec le vrai domaine. Ne retirez pas cette balise.

Le déploiement ne part **que depuis `main`** — l'environnement `github-pages`
n'autorise pas les autres branches. Travailler sur une branche est donc sans
effet sur l'aperçu tant qu'elle n'est pas fusionnée.

```bash
npm run build:preview   # reproduit localement le build d'aperçu
```

## Structure

```
src/
  data/site.ts           coordonnées, rubriques, navigation  ← à éditer en priorité
  data/content.json      les 55 pages de contenu (réalisations, principes, conseils)
  data/legacy-urls.txt   les 255 URL de l'ancien site (source des redirections)
  assets/photos/         121 photographies d'origine, optimisées au build
  components/            en-tête, pied de page, galerie, formulaire…
  pages/                 les gabarits
public/orbite/           19 images du rendu 3D « Panoramique » (animation d'accueil)
functions/api/contact.ts Worker Cloudflare : validation, archivage D1, envoi e-mail
scripts/build-redirects.mjs  génère public/_redirects avant chaque build
scripts/tga-to-frames.mjs    convertit un export 3D en TGA vers la séquence WebP
public/_redirects        GÉNÉRÉ — ne pas modifier à la main
```

## Ajouter ou modifier une réalisation

Tout le contenu vit dans `src/data/content.json`. Une entrée :

```json
{
  "slug": "maison-ossature-bois-lege-cap-ferret",
  "title": "Titre affiché dans l'onglet et sur Google (55-60 caractères)",
  "h1": "Titre affiché en haut de la page",
  "description": "Résumé affiché sous le titre dans Google (150-160 caractères).",
  "cat": "maisons",
  "bodyHtml": "<p>Le texte du projet, en HTML simple.</p>",
  "images": [{ "new": "nom-du-fichier.jpg", "alt": "Description de la photo" }]
}
```

- `cat` vaut `maisons`, `professionnels` ou `photovoltaique`.
- Les photos se déposent dans `src/assets/photos/`. Astro génère
  automatiquement les formats et tailles ; inutile de les redimensionner avant.
- L'`alt` de chaque photo doit décrire l'image : c'est ce que lit Google et ce
  qu'entendent les personnes malvoyantes.
- La première photo sert de vignette et d'image de partage sur les réseaux.

Après modification : `npm run build` pour vérifier, puis `git push` — Cloudflare
redéploie tout seul.

---

## Mise en ligne

### 1. Récupérer le nom de domaine

C'est l'étape à faire **avant** de résilier quoi que ce soit. Le domaine
`deniscartierarchitecte.fr` porte tout le référencement acquis ; il doit rester
au nom de Denis Cartier.

1. Vérifier le titulaire sur [afnic.fr/whois](https://www.afnic.fr/noms-de-domaine/whois/).
2. Demander à l'agence actuelle le **code de transfert (AuthInfo)** — elle est
   légalement tenue de le fournir.
3. Transférer le domaine vers Cloudflare Registrar (au prix coûtant) ou tout
   autre bureau d'enregistrement.
4. Seulement ensuite : résilier l'abonnement.

Récupérer aussi, tant que l'accès existe : la propriété de la **fiche Google
Business Profile** et l'accès à la **Search Console**. La fiche Google pèse
souvent plus lourd que le site pour les appels entrants.

### 2. Déployer sur Cloudflare Pages

```bash
npx wrangler login
npx wrangler pages project create deniscartierarchitecte --production-branch main
```

Puis connecter le dépôt GitHub dans le tableau de bord Cloudflare Pages :

- **Commande de build** : `npm run build`
- **Dossier de sortie** : `dist`
- **Version de Node** : 22

Chaque `git push` sur `main` déclenche un déploiement.

### 3. Formulaire de contact

```bash
# 1. Créer la base qui archive les demandes
npx wrangler d1 create deniscartier-contact
#    → reporter le database_id renvoyé dans wrangler.toml

# 2. Créer la table
npx wrangler d1 execute deniscartier-contact --remote --file=schema.sql

# 3. Enregistrer la clé de l'API d'envoi d'e-mail
npx wrangler pages secret put RESEND_API_KEY
```

Le service d'envoi (Resend, 3 000 e-mails/mois gratuits) demande de vérifier le
domaine par trois enregistrements DNS — cinq minutes si le domaine est déjà chez
Cloudflare. `CONTACT_TO` et `CONTACT_FROM` se règlent dans `wrangler.toml`.

**Aucune demande ne peut être perdue** : le message est écrit en base *avant*
toute tentative d'envoi. Pour relire les demandes reçues :

```bash
npx wrangler d1 execute deniscartier-contact --remote \
  --command "SELECT recu_le, nom, prenom, telephone, email, projet FROM demandes ORDER BY id DESC LIMIT 20"
```

Tant que `RESEND_API_KEY` n'est pas configurée, les demandes sont archivées en
base mais aucun e-mail ne part : configurez-la avant la bascule du domaine.

### 4. Le jour de la bascule

1. Faire pointer le domaine sur Cloudflare Pages.
2. Vérifier une dizaine d'anciennes URL — elles doivent renvoyer un **301** vers
   la nouvelle page :
   ```bash
   curl -sI "https://www.deniscartierarchitecte.fr/maison-d-architecte-w1" | head -3
   ```
3. Dans la Search Console, soumettre `https://www.deniscartierarchitecte.fr/sitemap-index.xml`.
4. Envoyer un message de test depuis le formulaire et vérifier sa réception.

---

## Ce qui a été fait pour préserver le référencement

| Mesure | Détail |
|---|---|
| **255 redirections 301** | Chaque URL de l'ancien sitemap pointe vers la page équivalente. Générées automatiquement (`scripts/build-redirects.mjs`), donc jamais désynchronisées. |
| **Titres et descriptions conservés** | Les `<title>` et `<meta description>` des pages qui se positionnaient sont repris tels quels. |
| **Contenu intégralement repris** | Les textes rédigés par Denis Cartier et les 121 photographies ont été récupérés, avec leurs attributs `alt`. |
| **Données structurées** | Schema.org `Architect` + `LocalBusiness` (adresse, téléphone, zone d'intervention), fil d'Ariane, pages projet — absentes de l'ancien site. |
| **Consolidation des pages vides** | Une quinzaine de pages générées automatiquement par l'agence, sans photo et au contenu dupliqué, redirigent vers la rubrique correspondante. C'est un gain : Google dévalue ces pages et elles pénalisaient l'ensemble du domaine. |
| **Performance** | Aucun framework côté navigateur, images en WebP servies à la bonne taille, polices auto-hébergées. La vitesse est un critère de classement. |
| **Sitemap et robots.txt** | Régénérés à chaque build. |

## Points à compléter avant la mise en ligne

- [ ] **Mentions légales** — compléter le numéro d'inscription à l'Ordre des
      architectes, l'assureur et le numéro de police, la TVA intracommunautaire
      (`src/pages/mentions-legales.astro`).
- [ ] **Image de partage** — une photo de couverture est générée
      automatiquement ; la remplacer si une image dédiée est préférée.
