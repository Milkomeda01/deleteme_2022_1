// S'execute sur https://preform-front-prp.floa.com/souscrire
// Selectionne "carte cdiscount" dans le select 2 (index 1) et "Emile Cartier"
// dans le select 3 (index 2), puis clique sur le bouton "Poster les donnees".
//
// Je n'ai pas pu inspecter le DOM reel de cette page (acces bloque depuis mon
// environnement), donc ce script cible les selects par POSITION (2e et 3e
// <select> de la page, comme demande) et cherche les options par TEXTE plutot
// que par id/value fige. Si la page a une structure differente, adapte les
// index CARD_SELECT_INDEX / NAME_SELECT_INDEX ci-dessous.

(function () {
  const CARD_SELECT_INDEX = 1; // "select 2"
  const NAME_SELECT_INDEX = 2; // "select 3"
  const CARD_MATCH = /cdiscount/i;
  const FIRSTNAME_MATCH = /emile/i;
  const LASTNAME_MATCH = /cartier/i;
  const SUBMIT_MATCH = /poster/i;
  const MAX_ATTEMPTS = 40; // ~20s
  const RETRY_DELAY_MS = 500;

  function log(msg) {
    console.log("[FLOA pre-formulaire]", msg);
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
    if (!opt) return false;
    select.value = opt.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function findSubmitButton() {
    const candidates = Array.from(
      document.querySelectorAll("button, input[type=submit], input[type=button], a")
    );
    return candidates.find((b) =>
      SUBMIT_MATCH.test((b.textContent || b.value || "").trim())
    );
  }

  function tryRun() {
    const selects = document.querySelectorAll("select");
    if (selects.length <= NAME_SELECT_INDEX) return false; // pas encore prets

    const cardSelect = selects[CARD_SELECT_INDEX];
    const nameSelect = selects[NAME_SELECT_INDEX];

    const cardOk = setSelect(cardSelect, [CARD_MATCH]);
    const nameOk =
      setSelect(nameSelect, [FIRSTNAME_MATCH, LASTNAME_MATCH]) ||
      setSelect(nameSelect, [LASTNAME_MATCH]);

    log(`Carte Cdiscount selectionnee: ${cardOk}`);
    log(`Emile Cartier selectionne: ${nameOk}`);

    if (!cardOk || !nameOk) {
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

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (tryRun() || attempts >= MAX_ATTEMPTS) {
      clearInterval(interval);
      if (attempts >= MAX_ATTEMPTS) log("Timeout: la page n'a pas expose 3 selects a temps.");
    }
  }, RETRY_DELAY_MS);
})();
