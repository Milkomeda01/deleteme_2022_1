export const site = {
  name: 'Denis Cartier Architecte',
  legalName: 'Denis Cartier — Architecte DPLG',
  url: 'https://www.deniscartierarchitecte.fr',
  // Numéro confirmé par le client (l'ancien site en affichait un second,
  // 05 40 25 05 39, qui n'est plus en service).
  phone: '05 40 25 05 05',
  phoneHref: '+33540250505',
  email: 'deniscartier@mac.com',
  address: {
    street: '4 rue Francis Martin',
    postalCode: '33000',
    city: 'Bordeaux',
    country: 'FR',
  },
  geo: { lat: 44.8404, lng: -0.5805 },
  areas: [
    'Bordeaux',
    "Bassin d'Arcachon",
    'Cap Ferret',
    'Lacanau',
    'Gironde',
    'Nouvelle-Aquitaine',
  ],
  openingHours: 'Lu-Ve 09:00-18:00',
} as const;

export const categories = {
  maisons: {
    slug: 'maisons-d-architecte',
    label: "Maisons d'architecte",
    navLabel: "Maisons d'architecte",
    title: "Architecte construction de maison design Bordeaux",
    description:
      "Vous rêvez d'une maison design en Gironde ? Denis Cartier Architecte est spécialisé dans la construction de maisons contemporaines haut de gamme sur Bordeaux et sa région.",
    h1: "Construction de maison d'architecte à Bordeaux",
    intro: [
      "Votre architecte Denis Cartier vous présente quelques-unes de ses réalisations de <strong>maisons contemporaines</strong> maçonnées, à <strong>ossature bois</strong> ou à <strong>ossature métallique</strong>, bâties sur la région de Bordeaux et du Bassin d'Arcachon.",
      "L'architecte vous accompagne tout au long de votre projet de construction et vous prodigue les bons conseils pour réaliser la maison de vos rêves. Pour mieux visualiser votre maison avant validation, nous vous proposons une <strong>virtualisation en 3D hyper-réaliste</strong>, qui vous permet de vous projeter.",
      "Besoin d'un architecte pour un projet de construction complet ou pour une demande de <strong>permis de construire</strong> ? Contactez Denis Cartier, architecte à Bordeaux.",
    ],
  },
  photovoltaique: {
    slug: 'centrale-photovoltaique',
    label: 'Centrale photovoltaïque',
    navLabel: 'Centrale photovoltaïque',
    title: 'Architecte centrale au sol photovoltaïque Bordeaux Gironde',
    description:
      "Architecte pour vos projets de centrale au sol photovoltaïque et d'agrivoltaïsme en Gironde : conception, permis de construire, intégration paysagère et suivi de chantier.",
    h1: 'Centrale au sol photovoltaïque en Gironde',
    intro: [
      "Chez Denis Cartier, architecte à Bordeaux, nous concevons des <strong>solutions sur-mesure pour l'installation de centrales au sol photovoltaïques en Gironde</strong>. Ce type d'installation est particulièrement adapté aux professionnels disposant de grands espaces non utilisés, comme des terrains industriels ou agricoles.",
      "Notre approche vise à maximiser le rendement énergétique tout en intégrant harmonieusement les panneaux dans l'environnement local. Nous vous accompagnons à toutes les étapes : conception, obtention des autorisations et suivi de l'installation.",
      "Transformez vos terrains inexploités en sources d'énergie renouvelable et participez activement à la transition énergétique.",
    ],
  },
  professionnels: {
    slug: 'batiments-professionnels',
    label: 'Bâtiments professionnels',
    navLabel: 'Bâtiments professionnels',
    title: "Cabinet d'architecture pour bâtiments professionnels à Bordeaux",
    description:
      "Architecte à Bordeaux pour la construction de bureaux, locaux médicaux, locaux industriels et logements collectifs en Gironde. Étude de faisabilité et suivi de chantier.",
    h1: 'Bâtiments professionnels et logements collectifs en Gironde',
    intro: [
      "Notre cabinet d'architecte bordelais accompagne les entreprises pour la construction de <strong>bureaux professionnels</strong> de petite et moyenne taille, de <strong>locaux médicaux</strong>, de <strong>locaux industriels</strong> conçus sur mesure, ainsi que d'ensembles de <strong>logements groupés ou collectifs</strong>.",
      "Nous vous apportons, lors de l'élaboration du projet, tous les conseils techniques et pratiques pour aboutir à la réalisation la plus juste, en tenant compte de vos besoins, des contraintes de l'environnement et de la structure même de l'édifice.",
      "Nous sommes votre interlocuteur privilégié durant toute la phase de conception et pendant le chantier. Pour toute demande de devis et d'étude de faisabilité, contactez votre architecte à Bordeaux.",
    ],
  },
} as const;

export type CategoryKey = keyof typeof categories;

export const nav = [
  { href: '/maisons-d-architecte/', label: "Maisons d'architecte" },
  { href: '/centrale-photovoltaique/', label: 'Centrale photovoltaïque' },
  { href: '/batiments-professionnels/', label: 'Bâtiments professionnels' },
  { href: '/savoir-faire/', label: 'Savoir-faire' },
  { href: '/conseils/', label: 'Conseils' },
  { href: '/contact/', label: 'Contact' },
];
