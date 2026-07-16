// Orchestre les deux etapes :
// 1) preform-front-prp.floa.com/souscrire -> selection carte + nom, soumission
// 2) preprod-souscrire.floabank.fr/carte-cdiscount/formulaire -> remplissage du parcours
//
// Le parcours FLOA est une "one page" : une fois qu'on est dessus, l'URL ne
// change plus. On n'injecte donc le script d'etape 2 qu'une seule fois par
// onglet, au premier chargement complet de cette page.
//
// Le choix de la carte (Cdiscount classique ou Cdiscount CLA) se fait dans le
// popup (popup.html/popup.js), qui envoie un message START_FLOW ici. Le choix
// est stocke dans chrome.storage.local pour que content/step1-preform.js
// puisse le relire une fois injecte sur la page du pre-formulaire.

const PREFORM_URL = "https://preform-front-prp.floa.com/souscrire";
const FORMULAIRE_HOST = "preprod-souscrire.floabank.fr";
const FORMULAIRE_PATH = "/carte-cdiscount/formulaire";

let activeTabId = null;
const injectedFormulaireTabs = new Set();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "START_FLOW") {
    startFlow(message.cardChoice);
  }
});

async function startFlow(cardChoice) {
  await chrome.storage.local.set({ floaCardChoice: cardChoice });
  const tab = await chrome.tabs.create({ url: PREFORM_URL });
  activeTabId = tab.id;
  injectedFormulaireTabs.delete(tab.id);
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

  if (details.url.startsWith(PREFORM_URL)) {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/step1-preform.js"],
    });
    return;
  }

  if (url.hostname === FORMULAIRE_HOST && url.pathname.startsWith(FORMULAIRE_PATH)) {
    if (injectedFormulaireTabs.has(details.tabId)) return;
    injectedFormulaireTabs.add(details.tabId);
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content/step2-formulaire.js"],
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) activeTabId = null;
  injectedFormulaireTabs.delete(tabId);
});
