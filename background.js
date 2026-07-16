// Orchestre les deux etapes :
// 1) preform-front-prp.floa.com -> selection environnement/carte/identite, soumission
// 2) preprod-souscrire.floabank.fr -> remplissage du parcours
//
// Le parcours FLOA est une "one page" : une fois qu'on est dessus, l'URL ne
// change plus. On n'injecte donc le script d'etape 2 qu'une seule fois par
// onglet confirme (voir plus bas).
//
// Les 3 choix du popup (environnement / carte / identite) sont envoyes ici
// via un message START_FLOW, stockes dans chrome.storage.local, et relus par
// content/step1-preform.js une fois injecte sur la page du pre-formulaire.

const PREFORM_HOST = "preform-front-prp.floa.com";
// Chemin du pre-formulaire selon l'environnement choisi dans le popup. Le
// chemin "validation-souscrire" est une supposition basee sur le nom donne -
// A CONFIRMER / adapter si besoin.
const ENVIRONMENT_PATHS = {
  souscrire: "/souscrire",
  "validation-souscrire": "/validation-souscrire",
};

const FORMULAIRE_HOST = "preprod-souscrire.floabank.fr";
// Le chemin exact differe entre la carte Cdiscount classique et la variante
// CLA (mais le parcours/DOM est identique), donc on ne filtre plus que sur
// le nom d'hote : des qu'on atterrit sur ce domaine, on injecte le script du
// parcours, qui attend lui-meme que #cdiscountForm existe avant d'agir (et
// se contente de logguer une erreur si ce n'est pas la bonne page).

let activeTabId = null;
// Un onglet ne passe dans cet ensemble qu'une fois que
// content/step2-formulaire.js a confirme avoir trouve #cdiscountForm (message
// FORMULAIRE_DETECTED). Tant qu'aucune confirmation n'est recue, chaque
// navigation sur le domaine reessaie l'injection (utile si la carte CLA passe
// par une page intermediaire avant le vrai formulaire).
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
  await chrome.storage.local.set({
    floaCardChoice: cardChoice || "cdiscount",
    floaPerson: person || "me",
  });

  const path = ENVIRONMENT_PATHS[environment] || ENVIRONMENT_PATHS.souscrire;
  const url = `https://${PREFORM_HOST}${path}`;

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

  if (url.hostname === PREFORM_HOST) {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/step1-preform.js"],
    });
    return;
  }

  if (url.hostname === FORMULAIRE_HOST) {
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
