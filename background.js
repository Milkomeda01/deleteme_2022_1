// Orchestre les deux etapes :
// 1) preform-front-{prp|val}.floa.com -> environnement/carte/identite, soumission
// 2) {preprod|validation}-souscrire.floabank.fr -> remplissage du parcours
//
// Le parcours FLOA est une "one page" : une fois qu'on est dessus, l'URL ne
// change plus. On n'injecte donc le script d'etape 2 qu'une seule fois par
// onglet confirme (voir plus bas).
//
// Les 3 choix du popup (environnement / carte / identite) sont envoyes ici
// via un message START_FLOW, stockes dans chrome.storage.local, et relus par
// content/step1-preform.js une fois injecte sur la page du pre-formulaire.
//
// Chaque environnement a son PROPRE domaine de pre-formulaire et son PROPRE
// domaine de formulaire final (pas juste un chemin qui change) :
// - souscrire            : preform-front-prp.floa.com -> preprod-souscrire.floabank.fr
// - validation-souscrire : preform-front-val.floa.com -> validation-souscrire.floabank.fr
// Sur l'environnement "validation", il y a en plus un select "environnement"
// AVANT le select carte (donc en position 0), qu'il faut positionner sur
// "validation" - voir content/step1-preform.js.
const ENVIRONMENTS = {
  souscrire: {
    preformHost: "preform-front-prp.floa.com",
    preformPath: "/souscrire",
    formulaireHost: "preprod-souscrire.floabank.fr",
    needsEnvSelect: false,
  },
  "validation-souscrire": {
    preformHost: "preform-front-val.floa.com",
    preformPath: "/souscrire",
    formulaireHost: "validation-souscrire.floabank.fr",
    needsEnvSelect: true,
  },
};

const PREFORM_HOSTS = Object.values(ENVIRONMENTS).map((e) => e.preformHost);
const FORMULAIRE_HOSTS = Object.values(ENVIRONMENTS).map((e) => e.formulaireHost);

let activeTabId = null;
// Un onglet ne passe dans cet ensemble qu'une fois que
// content/step2-formulaire.js a confirme avoir trouve #cdiscountForm (message
// FORMULAIRE_DETECTED). Tant qu'aucune confirmation n'est recue, chaque
// navigation sur un domaine de formulaire reessaie l'injection (utile si la
// carte CLA passe par une page intermediaire avant le vrai formulaire).
const confirmedFormulaireTabs = new Set();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "START_FLOW") {
    startFlow(message);
  }
  if (message?.type === "FORMULAIRE_DETECTED" && sender.tab) {
    confirmedFormulaireTabs.add(sender.tab.id);
  }
});

async function startFlow({ environment, cardChoice, person }) {
  const env = ENVIRONMENTS[environment] || ENVIRONMENTS.souscrire;

  await chrome.storage.local.set({
    floaEnvironment: environment || "souscrire",
    floaCardChoice: cardChoice || "cdiscount",
    floaPerson: person || "me",
  });

  const url = `https://${env.preformHost}${env.preformPath}`;
  const tab = await chrome.tabs.create({ url });
  activeTabId = tab.id;
  confirmedFormulaireTabs.delete(tab.id);
}

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return; // uniquement la frame principale
  if (details.tabId !== activeTabId) return; // uniquement l'onglet qu'on a ouvert

  let url;
  try {
    url = new URL(details.url);
  } catch {
    return;
  }

  if (PREFORM_HOSTS.includes(url.hostname)) {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/step1-preform.js"],
    });
    return;
  }

  if (FORMULAIRE_HOSTS.includes(url.hostname)) {
    if (confirmedFormulaireTabs.has(details.tabId)) return;
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/step2-formulaire.js"],
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) activeTabId = null;
  confirmedFormulaireTabs.delete(tabId);
});
