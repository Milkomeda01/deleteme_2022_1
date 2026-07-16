// S'execute sur https://preprod-souscrire.floabank.fr/carte-cdiscount/formulaire
//
// Ce parcours est une "one page" Vue.js : toutes les etapes (identity,
// nationality-birth, family, house, profession, income, charges, options)
// sont deja dans le DOM, chacune dans un <div class="step-form"> affiche /
// masque tour a tour. Un seul bouton "Suivant" fait avancer d'etape en etape.
//
// IMPORTANT : ce script s'ARRETE volontairement juste apres avoir rempli
// l'etape "Options". Il ne clique JAMAIS le "Suivant" qui ferait basculer
// vers l'etape Finalisation/Signature.
//
// Les champs du site utilisent des web components maison (ds-selector,
// ds-select, ds-input-text, ds-select-search, ds-button, ds-dialog...).
// Comme je n'ai pas pu tester en direct sur le vrai site, l'interaction avec
// chaque champ essaie plusieurs strategies (valeur directe + evenements,
// shadow DOM, clic simule) et journalise clairement ce qui a marche ou pas
// dans le panneau flottant en haut a droite de la page + la console (F12).
// Verifie toujours visuellement le formulaire avant de continuer a la main.

(function () {
  // ======================= CONFIG A ADAPTER =============================
  const CONFIG = {
    nationality: "France", // France | UE | Autre
    birthDepartment: "01", // code departement, ex "33"
    birthCity: "Bourg-en-Bresse", // ville de naissance (recherche)

    maritalStatus: "C", // C K M P D S V A
    kids: 0, // 0..7

    housing: "P", // L A P V E Z

    professionGroup: "private", // private public independent retired unemployed other
    professionValue: "8", // valeur du <option> du select Profession (8 = Cadre)
    contractType: "CDI", // CDI CDD INT AUT

    incomeBracket: 6, // 0..6  (6 = superieur a 3000 euros)
    chargesBracket: 1, // 0..5  (1 = 250 a 500 euros)

    insuranceADE: "refuse", // premium | confort | essentielle | refuse
    insurancePFP: "refuse", // plus | standard | refuse

    declineGoldUpsell: true,
  };
  // ========================================================================

  const STEP_SELECTORS = [
    "identity",
    "nationality-birth",
    "family",
    "house",
    "profession",
    "income",
    "charges",
    "options",
  ];

  const PROFESSION_GROUP_IDS = {
    private: "profession-group-privateGroup",
    public: "profession-group-publicGroup",
    independent: "profession-group-independentGroup",
    retired: "profession-group-retiredGroup",
    unemployed: "profession-group-unemployedGroup",
    other: "profession-group-otherGroup",
  };

  const INSURANCE_ADE_TESTID = {
    premium: "options-premium",
    confort: "options-confort",
    essentielle: "options-essentielle",
    refuse: "options-assuranceEmprunteur-aucune",
  };

  const INSURANCE_PFP_TESTID = {
    plus: "options-assurance-familyProtectPlus",
    standard: "options-assurance-familyProtect",
    refuse: "options-assurancePack-aucune",
  };

  // --------------------------- utilitaires --------------------------------

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  async function waitFor(fn, timeoutMs = 15000, intervalMs = 200) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const val = fn();
      if (val) return val;
      await sleep(intervalMs);
    }
    return null;
  }

  function findButtonByText(regex, root = document) {
    const candidates = Array.from(root.querySelectorAll("ds-button, button, a"));
    return candidates.find(
      (b) => regex.test((b.textContent || "").trim()) && isVisible(b)
    );
  }

  function setNativeValue(field, value) {
    const proto =
      field.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : field.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  // Champs custom (ds-selector, ds-selector-insurance, ds-switch...) : un
  // clic simule est l'interaction "utilisateur reelle" la plus fiable.
  function clickCustom(el) {
    if (!el) return false;
    el.click();
    return true;
  }

  // ds-select / ds-select-search : essaie valeur directe + evenements, PUIS
  // (en secours) ouvre le composant et clique l'option visible correspondante.
  async function setDropdown(el, value, textRegex) {
    if (!el) return false;

    // Strategie A : valeur directe sur le host (composants form-associated)
    try {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } catch (e) {
      /* ignore */
    }

    // Strategie B : <select> natif cache dans un shadow DOM ouvert
    const shadowSelect = el.shadowRoot?.querySelector("select");
    if (shadowSelect) {
      setNativeValue(shadowSelect, value);
    }

    await sleep(250);

    // Strategie C : ouverture + clic sur l'option affichee (texte)
    if (textRegex) {
      await openAndClickOption(el, textRegex);
    }
    return true;
  }

  async function openAndClickOption(el, textRegex) {
    el.click();
    await sleep(350);

    const pools = [
      document.querySelectorAll('[role="option"], li, ds-select-option, option'),
      el.shadowRoot ? el.shadowRoot.querySelectorAll('[role="option"], li, option') : [],
    ];

    for (const pool of pools) {
      const match = Array.from(pool).find(
        (o) => isVisible(o) && textRegex.test((o.textContent || "").trim())
      );
      if (match) {
        match.click();
        await sleep(200);
        return true;
      }
    }
    return false;
  }

  // Champ texte/recherche encapsule dans un shadow DOM (ds-input-text,
  // ds-select-search...) : on tape le texte dans l'<input> reel puis on
  // clique la suggestion correspondante.
  async function fillSearchField(el, text, suggestionRegex) {
    const input = el.shadowRoot?.querySelector("input") || el.querySelector("input");
    if (!input) return false;
    input.focus();
    setNativeValue(input, text);
    await sleep(900); // laisse le temps a l'auto-completion de repondre
    return openAndClickOption(el, suggestionRegex || new RegExp(text.split(/\s/)[0], "i"));
  }

  // ------------------------- panneau de log --------------------------------

  let panelBody;
  function showPanel() {
    const panel = document.createElement("div");
    panel.id = "floa-autofill-panel";
    panel.style.cssText = [
      "position:fixed", "top:12px", "right:12px", "z-index:2147483647",
      "width:340px", "max-height:70vh", "overflow:auto",
      "background:#111", "color:#0f0", "font:12px/1.4 monospace",
      "padding:10px", "border-radius:8px", "box-shadow:0 4px 20px rgba(0,0,0,.4)",
    ].join(";");
    panel.innerHTML = '<strong style="color:#fff">FLOA Auto-remplissage</strong><div id="floa-autofill-body"></div>';
    document.documentElement.appendChild(panel);
    panelBody = panel.querySelector("#floa-autofill-body");
  }

  function log(msg, level = "info") {
    const color = level === "warn" ? "#ffb020" : level === "error" ? "#ff5050" : "#0f0";
    console.log("[FLOA formulaire]", msg);
    if (panelBody) {
      const line = document.createElement("div");
      line.style.color = color;
      line.textContent = msg;
      panelBody.appendChild(line);
      panelBody.scrollTop = panelBody.scrollHeight;
    }
  }

  // --------------------------- gestion des popins ---------------------------

  async function handleDialogs() {
    // "Avez-vous bien verifie vos donnees personnelles ?" -> continuer
    let btn = findButtonByText(/^Poursuivre ma demande$/i);
    if (btn) {
      log("Popin verification donnees personnelles -> 'Poursuivre ma demande'.");
      clickCustom(btn);
      await sleep(400);
    }

    // Upsell carte Gold -> refuser
    if (CONFIG.declineGoldUpsell) {
      btn = findButtonByText(/^Non merci$/i);
      if (btn) {
        log("Popin carte Gold -> 'Non merci'.");
        clickCustom(btn);
        await sleep(400);
      }
    }

    // Confirmation de refus d'assurance -> confirmer le refus
    const refuseModal = document.querySelector(".refuse-insurance-modal");
    if (refuseModal && isVisible(refuseModal)) {
      btn = findButtonByText(/n'adhère pas|n'adhere pas/i, refuseModal) || findButtonByText(/n'adhère pas|n'adhere pas/i);
      if (btn) {
        log("Popin confirmation refus assurance -> confirmation du refus.");
        clickCustom(btn);
        await sleep(400);
      }
    }
  }

  // ------------------------------ etapes ------------------------------------

  async function fillIdentity() {
    log("Identite deja pre-remplie via le pre-formulaire (civilite/nom/prenom/naissance/adresse/telephone).");
  }

  async function fillNationalityBirth(stepDiv) {
    if (CONFIG.nationality === "France") {
      clickCustom(stepDiv.querySelector("#nationality-F"));
    } else if (CONFIG.nationality === "UE") {
      clickCustom(stepDiv.querySelector("#nationality-UE"));
    } else {
      clickCustom(stepDiv.querySelector("#nationality-XX"));
    }
    log(`Nationalite: ${CONFIG.nationality}`);
    await sleep(200);

    const deptSelect = stepDiv.querySelector('[data-testid="department"]');
    if (deptSelect) {
      await setDropdown(deptSelect, CONFIG.birthDepartment, new RegExp(`^${CONFIG.birthDepartment}\\s*-`, "i"));
      log(`Departement de naissance: ${CONFIG.birthDepartment}`);
    } else {
      log("Select departement introuvable.", "warn");
    }

    const citySearch = stepDiv.querySelector("ds-select-search");
    if (citySearch) {
      const ok = await fillSearchField(citySearch, CONFIG.birthCity);
      log(
        ok
          ? `Ville de naissance saisie: ${CONFIG.birthCity}`
          : `Ville de naissance "${CONFIG.birthCity}" non confirmee automatiquement -> VERIFIE et selectionne-la manuellement.`,
        ok ? "info" : "warn"
      );
    } else {
      log("Champ ville de naissance introuvable -> a remplir manuellement.", "warn");
    }
  }

  async function fillFamily(stepDiv) {
    clickCustom(stepDiv.querySelector(`#marital-status-${CONFIG.maritalStatus}`));
    log(`Situation familiale: ${CONFIG.maritalStatus}`);
    await sleep(150);
    clickCustom(stepDiv.querySelector(`#kids-${CONFIG.kids}`));
    log(`Enfants a charge: ${CONFIG.kids}`);
  }

  async function fillHouse(stepDiv) {
    const el = stepDiv.querySelector(`[data-testid="logement-${CONFIG.housing}"]`);
    clickCustom(el);
    log(`Logement: ${CONFIG.housing}${el ? "" : " (element introuvable !)"}`, el ? "info" : "warn");
  }

  async function fillProfession(stepDiv) {
    const groupId = PROFESSION_GROUP_IDS[CONFIG.professionGroup];
    clickCustom(stepDiv.querySelector(`#${groupId}`));
    log(`Secteur d'activite: ${CONFIG.professionGroup}`);
    await sleep(200);

    // Attention : la <section> parente porte aussi id="profession", donc on
    // cible via data-testid pour ne pas matcher la section par erreur.
    const professionSelect = stepDiv.querySelector('[data-testid="profession"]');
    if (professionSelect) {
      await setDropdown(professionSelect, CONFIG.professionValue);
      log(`Profession (valeur=${CONFIG.professionValue}) selectionnee -> VERIFIE le libelle affiche.`);
    } else {
      log("Select profession introuvable.", "warn");
    }

    await sleep(150);
    clickCustom(stepDiv.querySelector(`#contract-${CONFIG.contractType}`));
    log(`Type de contrat: ${CONFIG.contractType}`);
  }

  async function fillIncome(stepDiv) {
    const el = stepDiv.querySelector(`#income-${CONFIG.incomeBracket}`);
    clickCustom(el);
    log(`Revenus: tranche ${CONFIG.incomeBracket}${el ? "" : " (element introuvable !)"}`, el ? "info" : "warn");
  }

  async function fillCharges(stepDiv) {
    const el = stepDiv.querySelector(`#charges-${CONFIG.chargesBracket}`);
    clickCustom(el);
    log(`Charges: tranche ${CONFIG.chargesBracket}${el ? "" : " (element introuvable !)"}`, el ? "info" : "warn");
  }

  async function fillOptions(stepDiv) {
    const adeTestId = INSURANCE_ADE_TESTID[CONFIG.insuranceADE];
    const adeEl = stepDiv.querySelector(`[data-testid="${adeTestId}"]`);
    clickCustom(adeEl);
    log(`Assurance emprunteur: ${CONFIG.insuranceADE}${adeEl ? "" : " (element introuvable !)"}`, adeEl ? "info" : "warn");
    await sleep(300);
    await handleDialogs();

    const pfpTestId = INSURANCE_PFP_TESTID[CONFIG.insurancePFP];
    const pfpEl = stepDiv.querySelector(`[data-testid="${pfpTestId}"]`);
    clickCustom(pfpEl);
    log(`Pack Family Protect: ${CONFIG.insurancePFP}${pfpEl ? "" : " (element introuvable !)"}`, pfpEl ? "info" : "warn");
    await sleep(300);
    await handleDialogs();

    log('Code secret laisse VIDE (choix "code aleatoire" -> ce choix apparait seulement en essayant de valider, etape volontairement non declenchee).', "warn");
    log('Champ OUI/NON apres le code secret : je ne connais pas son libelle exact -> laisse tel quel, VERIFIE-le toi-meme avant de continuer.', "warn");
  }

  const STEP_HANDLERS = [
    fillIdentity,
    fillNationalityBirth,
    fillFamily,
    fillHouse,
    fillProfession,
    fillIncome,
    fillCharges,
    fillOptions,
  ];

  async function clickSuivant() {
    const btn = findButtonByText(/^Suivant$/i);
    if (!btn) {
      log("Bouton 'Suivant' introuvable.", "error");
      return false;
    }
    clickCustom(btn);
    await sleep(500);
    return true;
  }

  // ------------------------------- main --------------------------------------

  async function main() {
    const formRoot = await waitFor(() => document.querySelector("#cdiscountForm"));
    if (!formRoot) {
      // Mauvaise page (ex: etape intermediaire avant le vrai formulaire) :
      // on ne previent pas le background, qui reessaiera l'injection a la
      // prochaine navigation sur ce domaine.
      return;
    }
    chrome.runtime.sendMessage({ type: "FORMULAIRE_DETECTED" });

    showPanel();
    log("Formulaire detecte, debut du remplissage automatique.");

    const stepDivs = await waitFor(() => {
      const divs = document.querySelectorAll(".step-form");
      return divs.length >= STEP_SELECTORS.length ? divs : null;
    });

    if (!stepDivs) {
      log("Impossible de trouver les 8 sections attendues du parcours -> arret.", "error");
      return;
    }

    await handleDialogs();

    for (let i = 0; i < STEP_HANDLERS.length; i++) {
      const stepDiv = stepDivs[i];
      await waitFor(() => isVisible(stepDiv));
      log(`--- Etape ${i + 1}/8 : ${STEP_SELECTORS[i]} ---`);
      await STEP_HANDLERS[i](stepDiv);
      await handleDialogs();

      const isLastStep = i === STEP_HANDLERS.length - 1;
      if (isLastStep) {
        log("Options remplies. ARRET VOLONTAIRE : je ne clique pas sur 'Suivant' (cela menerait a la Signature).");
        log("Verifie tous les champs (departement/ville de naissance, profession, assurances, code secret, champ OUI/NON) puis continue toi-meme.");
        break;
      }

      const advanced = await clickSuivant();
      if (!advanced) break;
      await handleDialogs();
    }
  }

  main();
})();
