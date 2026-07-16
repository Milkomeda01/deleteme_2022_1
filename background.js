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
    startFlow(message.cardChoice);
  }
  if (message?.type === "FORMULAIRE_DETECTED" && sender.tab) {
    confirmedFormulaireTabs.add(sender.tab.id);
  }
});

async function startFlow(cardChoice) {
  await chrome.storage.local.set({ floaCardChoice: cardChoice });
  const tab = await chrome.tabs.create({ url: PREFORM_URL });
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

  if (details.url.startsWith(PREFORM_URL)) {
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
