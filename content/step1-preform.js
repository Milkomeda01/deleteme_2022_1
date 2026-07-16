// S'execute sur https://preform-front-prp.floa.com/souscrire
// Selectionne la carte choisie dans le popup (Cdiscount classique ou
// Cdiscount CLA) dans le select 2 (index 1), "Emile Cartier" dans le
// select 3 (index 2), puis clique sur le bouton "Poster les donnees".
//
// Je n'ai pas pu inspecter le DOM reel de cette page (acces bloque depuis mon
// environnement), donc ce script cible les selects par POSITION (2e et 3e
// <select> de la page, comme demande) et cherche les options par TEXTE plutot
// que par id/value fige. Si la page a une structure differente, adapte les
// index CARD_SELECT_INDEX / NAME_SELECT_INDEX ci-dessous.
//
// Le choix de carte est lu depuis chrome.storage.local (cle
// "floaCardChoice", ecrite par le popup / background.js) : "cdiscount" ou
// "cdiscount_cla". Je ne connais pas le libelle exact des options du select,
// donc je matche toute option contenant "cdiscount", en excluant celles
// contenant "cla" pour la carte classique, et en exigeant "cla" pour la
// variante CLA. VERIFIE l'option reellement selectionnee dans le log.

(function () {
  const CARD_SELECT_INDEX = 1; // "select 2"
  const NAME_SELECT_INDEX = 2; // "select 3"
  const FIRSTNAME_MATCH = /emile/i;
  const LASTNAME_MATCH = /cartier/i;
  const SUBMIT_MATCH = /poster/i;
  const MAX_ATTEMPTS = 40; // ~20s
  const RETRY_DELAY_MS = 500;

  function log(msg) {
    console.log("[FLOA pre-formulaire]", msg);
  }

  function buildCardMatcher(cardChoice) {
    if (cardChoice === "cdiscount_cla") {
      return { test: (text) => /cdiscount/i.test(text) && /cla/i.test(text) };
    }
    return { test: (text) => /cdiscount/i.test(text) && !/cla/i.test(text) };
  }

  function pickOption(select, matchers) {
    const options = Array.from(select.options);
    return (
      options.find((o) => matchers.every((m) => m.test(o.textContent || ""))) ||
      options.find((o) => matchers.some((m) => m.test(o.textContent || "")))
    );
  }

  function setSelect(select, matchers) {
    const opt = pickOption(select, matchers);
    if (!opt) return null;
    select.value = opt.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return opt;
  }

  function findSubmitButton() {
    const candidates = Array.from(
      document.querySelectorAll("button, input[type=submit], input[type=button], a")
    );
    return candidates.find((b) =>
      SUBMIT_MATCH.test((b.textContent || b.value || "").trim())
    );
  }

  function tryRun(cardMatcher, cardChoice) {
    const selects = document.querySelectorAll("select");
    if (selects.length <= NAME_SELECT_INDEX) return false; // pas encore prets

    const cardSelect = selects[CARD_SELECT_INDEX];
    const nameSelect = selects[NAME_SELECT_INDEX];

    const cardOpt = setSelect(cardSelect, [cardMatcher]);
    const nameOpt =
      setSelect(nameSelect, [FIRSTNAME_MATCH, LASTNAME_MATCH]) ||
      setSelect(nameSelect, [LASTNAME_MATCH]);

    log(`Carte demandee: ${cardChoice} -> option retenue: "${cardOpt ? cardOpt.textContent.trim() : "AUCUNE"}"`);
    log(`Nom demande: Emile Cartier -> option retenue: "${nameOpt ? nameOpt.textContent.trim() : "AUCUNE"}"`);

    if (!cardOpt || !nameOpt) {
      log("Selection incomplete -> soumission ANNULEE. Verifie manuellement les selects.");
      return true; // on arrete de reessayer mais on ne soumet pas
    }

    const submitBtn = findSubmitButton();
    if (!submitBtn) {
      log("Bouton 'Poster les donnees' introuvable -> soumission ANNULEE. Clique-le manuellement.");
      return true;
    }

    log("Clic sur le bouton de soumission.");
    submitBtn.click();
    return true;
  }

  async function init() {
    const { floaCardChoice } = await chrome.storage.local.get("floaCardChoice");
    const cardChoice = floaCardChoice || "cdiscount";
    const cardMatcher = buildCardMatcher(cardChoice);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (tryRun(cardMatcher, cardChoice) || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        if (attempts >= MAX_ATTEMPTS) log("Timeout: la page n'a pas expose 3 selects a temps.");
      }
    }, RETRY_DELAY_MS);
  }

  init();
})();
