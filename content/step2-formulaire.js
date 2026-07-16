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
    // Ville de naissance : on ne tape plus de texte, on ouvre le champ et on
    // prend la 1ere suggestion proposee par le site (comportement demande).

    maritalStatus: "C", // C K M P D S V A
    kids: 0, // 0..7

    housing: "P", // L A P V E Z

    professionGroup: "private", // private public independent retired unemployed other
    professionValue: "8", // valeur du <option> du select Profession (8 = Cadre)
    contractType: "CDI", // CDI CDD INT AUT

    incomeBracket: 6, // 0..6  (6 = superieur a 3000 euros)
    chargesBracket: 1, // 0..5  (1 = 250 a 500 euros)

    insuranceADE: "essentielle", // premium | confort | essentielle | refuse
    insurancePFP: "standard", // plus | standard | refuse

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

  // Sur ce design system, l'element vraiment interactif (celui qui porte
  // aria-checked/aria-selected et qui reagit au clic) est SOUVENT a
  // l'interieur du shadow DOM de l'element hote (ex: un <label
  // aria-checked> pour ds-selector-insurance, un <li role="row"
  // aria-selected> pour une ligne de suggestion) - cliquer l'hote lui-meme
  // ne suffit pas. On cherche donc en priorite ce noeud interne.
  function findShadowInteractive(el) {
    if (!el || !el.shadowRoot) return null;
    return el.shadowRoot.querySelector(
      'label[aria-checked], label[tabindex], [role="radio"], [role="checkbox"], li[role="row"], li[role="option"], [role="option"], input, button'
    );
  }

  // Sequence complete d'evenements souris + clavier (Espace/Entree), pour
  // maximiser les chances de declencher le handler du composant quel qu'il
  // soit (certains n'ecoutent que pointerdown/mouseup, d'autres seulement le
  // clavier pour l'accessibilite ARIA).
  function simulateClick(target) {
    if (!target) return false;
    const opts = { bubbles: true, cancelable: true, composed: true };
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.click();
    target.dispatchEvent(new KeyboardEvent("keydown", { ...opts, key: " ", code: "Space" }));
    target.dispatchEvent(new KeyboardEvent("keyup", { ...opts, key: " ", code: "Space" }));
    return true;
  }

  // Champs custom (ds-selector, ds-selector-insurance, ds-switch...) : un
  // clic simule est l'interaction "utilisateur reelle" la plus fiable, sur
  // le noeud interne du shadow DOM quand il existe.
  function clickCustom(el) {
    if (!el) return false;
    const target = findShadowInteractive(el) || el;
    return simulateClick(target);
  }

  function isChecked(el) {
    if (!el) return false;
    const target = findShadowInteractive(el);
    if (target) {
      if (target.getAttribute("aria-checked") === "true") return true;
      if (target.getAttribute("aria-selected") === "true") return true;
      if ("checked" in target && target.checked) return true;
    }
    return (
      el.hasAttribute("checked") ||
      el.getAttribute("aria-checked") === "true" ||
      el.shadowRoot?.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked') != null
    );
  }

  // Clique et verifie que ca a bien "pris" (attribut checked/aria-checked).
  // Reessaie une fois si non confirme, pour les composants un peu lents a
  // reagir. Retourne le resultat de la verification (true/false), utile
  // pour logguer un avertissement clair si ca n'a vraiment pas fonctionne.
  async function clickAndVerify(el, waitMs = 300) {
    if (!el) return false;
    clickCustom(el);
    await sleep(waitMs);
    if (isChecked(el)) return true;
    clickCustom(el);
    await sleep(waitMs);
    return isChecked(el);
  }

  // Cherche recursivement TOUS les <select> natifs du document, y compris a
  // l'interieur de n'importe quel shadow DOM ouvert (le champ visible n'est
  // parfois qu'une facade CSS, avec un vrai <select> natif superpose,
  // dessine par le navigateur lui-meme quand on l'ouvre - c'est ce qui donne
  // le menu deroulant natif observe en test).
  function findAllSelectsDeep(root = document) {
    const results = Array.from(root.querySelectorAll("select"));
    const all = root.querySelectorAll("*");
    for (const node of all) {
      if (node.shadowRoot) results.push(...findAllSelectsDeep(node.shadowRoot));
    }
    return results;
  }

  // ds-select / ds-select-search : essaie plusieurs strategies dans l'ordre
  // jusqu'a ce que l'une d'elles fonctionne.
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

    // Strategie B : <select> natif deja present dans un shadow DOM ouvert
    const shadowSelect = el.shadowRoot?.querySelector("select");
    if (shadowSelect) setNativeValue(shadowSelect, value);

    // Ouvre le composant (peut reveler/creer un <select> natif en secours,
    // et est de toute facon necessaire pour les strategies suivantes).
    el.click();
    await sleep(350);

    // Strategie B2 : <select> natif quelque part dans le document (souvent
    // une facade cliquable + un vrai <select> superpose que le navigateur
    // affiche nativement une fois ouvert), trouve par son contenu d'options.
    const nativeSelects = findAllSelectsDeep();
    const matchingSelect = nativeSelects.find((s) =>
      Array.from(s.options).some((o) => o.value === value)
    );
    if (matchingSelect) {
      setNativeValue(matchingSelect, value);
      await sleep(200);
      return true;
    }

    // Strategie C : clic sur l'option visible correspondante (texte)
    let ok = false;
    if (textRegex) {
      ok = await openAndClickOption(el, textRegex, true);
    }

    // Strategie D (dernier recours) : navigation clavier jusqu'a la position
    // de l'option correspondante dans la liste des <option> du DOM clair.
    if (!ok) {
      ok = await keyboardSelectByValue(el, value);
    }
    return ok;
  }

  async function openAndClickOption(el, textRegex, alreadyOpen = false) {
    if (!alreadyOpen) {
      el.click();
      await sleep(350);
    }

    const selector =
      'ds-select-search-option, ds-select-option, ds-option, [role="option"], li, option, [class*="option"]';
    const pools = [
      el.shadowRoot ? el.shadowRoot.querySelectorAll('li[role="row"], li[role="option"], [role="option"], li') : [],
      el.querySelectorAll(selector),
      document.querySelectorAll(selector),
      el.shadowRoot ? el.shadowRoot.querySelectorAll(selector) : [],
    ];

    for (const pool of pools) {
      const match = Array.from(pool).find(
        (o) => isVisible(o) && textRegex.test((o.textContent || "").trim())
      );
      if (match) {
        simulateClick(match);
        await sleep(200);
        return true;
      }
    }
    return false;
  }

  // Ouvre un champ (ds-select-search...) et clique la 1ere suggestion visible
  // proposee par le site, sans se soucier de son texte. Utilise pour la
  // ville de naissance : le site propose une liste par defaut des qu'on
  // ouvre le champ (pas besoin/pas fiable de taper un texte de recherche).
  //
  // Confirme par inspection : la ligne REELLEMENT cliquable est un
  // <li role="row"> rendu DANS le shadow DOM du champ (pas les
  // <ds-select-search-option> en DOM clair, qui ne sont que la source de
  // donnees projetee via <slot> et ne reagissent pas au clic elles-memes).
  // On cible donc le shadow DOM en priorite.
  async function pickFirstSuggestion(el) {
    // Le simple clic sur l'element hote ne suffit pas a declencher
    // l'affichage des suggestions par defaut : il faut donner le focus au
    // vrai <input> interne (comme le faisait l'ancienne version qui
    // fonctionnait, avant d'etre simplifiee par erreur).
    const input = el.shadowRoot?.querySelector("input") || el.querySelector("input");
    const focusTarget = input || el;
    focusTarget.focus?.();
    focusTarget.dispatchEvent(new FocusEvent("focus", { bubbles: true, composed: true }));
    focusTarget.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    simulateClick(focusTarget);
    await sleep(900);

    const specificSelector = "ds-select-search-option, ds-select-option, ds-option";
    const genericSelector =
      '[role="option"], [role="row"], [role="gridcell"], li, [class*="option"], [class*="suggestion"], [class*="result"]';

    const pools = [
      el.shadowRoot ? el.shadowRoot.querySelectorAll('li[role="row"], li[role="option"], [role="option"], li') : [],
      el.querySelectorAll(specificSelector),
      el.querySelectorAll(genericSelector),
      document.querySelectorAll(specificSelector),
      el.shadowRoot ? el.shadowRoot.querySelectorAll(specificSelector + ", " + genericSelector) : [],
      document.querySelectorAll(genericSelector),
    ];

    for (let poolIndex = 0; poolIndex < pools.length; poolIndex++) {
      const candidates = Array.from(pools[poolIndex])
        .filter((o) => isVisible(o) && (o.textContent || "").trim().length > 0)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (candidates[0]) {
        const target = candidates[0];
        const label = target.textContent.trim();
        simulateClick(target);
        await sleep(300);
        return label;
      }
    }
    return null;
  }

  // Navigue au clavier (Fleche bas x N + Entree) jusqu'a l'option dont la
  // <option value="..."> du DOM clair correspond. Suppose que le composant
  // est deja ouvert (appele en dernier recours depuis setDropdown). Fonctionne
  // meme si la liste visible est entierement dans un shadow DOM ferme, tant
  // que le composant gere le clavier sur son element hote.
  async function keyboardSelectByValue(el, value) {
    const options = Array.from(el.querySelectorAll("option"));
    const index = options.findIndex((o) => o.value === value);
    if (index === -1) return false;

    el.focus?.();
    for (let i = 0; i <= index; i++) {
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, composed: true })
      );
      await sleep(60);
    }
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true })
    );
    await sleep(250);
    return true;
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
      const picked = await pickFirstSuggestion(citySearch);
      log(
        picked
          ? `Ville de naissance: 1ere suggestion retenue "${picked}"`
          : "Ville de naissance: aucune suggestion trouvee -> a remplir manuellement.",
        picked ? "info" : "warn"
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
    // Les cartes d'assurance semblent se charger un peu apres l'affichage
    // de l'etape (probablement une recommandation calculee/chargee a part) :
    // on attend qu'au moins une carte existe avant de chercher les data-testid.
    await waitFor(() => stepDiv.querySelector('[data-insurance-type="ADE"]'), 5000);

    const adeTestId = INSURANCE_ADE_TESTID[CONFIG.insuranceADE];
    const adeEl = stepDiv.querySelector(`[data-testid="${adeTestId}"]`);
    if (adeEl) {
      const confirmed = await clickAndVerify(adeEl);
      log(
        `Assurance emprunteur: ${CONFIG.insuranceADE}${confirmed ? "" : " -> PAS CONFIRME COCHE, verifie manuellement"}`,
        confirmed ? "info" : "warn"
      );
    } else {
      log(`Assurance emprunteur: ${CONFIG.insuranceADE} (element introuvable !)`, "warn");
    }
    await handleDialogs();

    const pfpTestId = INSURANCE_PFP_TESTID[CONFIG.insurancePFP];
    const pfpEl = stepDiv.querySelector(`[data-testid="${pfpTestId}"]`);
    if (pfpEl) {
      const confirmed = await clickAndVerify(pfpEl);
      log(
        `Pack Family Protect: ${CONFIG.insurancePFP}${confirmed ? "" : " -> PAS CONFIRME COCHE, verifie manuellement"}`,
        confirmed ? "info" : "warn"
      );
    } else {
      log(`Pack Family Protect: ${CONFIG.insurancePFP} (element introuvable !)`, "warn");
    }
    await handleDialogs();
    // Code secret et champ OUI/NON juste apres : laisses volontairement tels
    // quels, on n'y touche pas.
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
        log("Code secret et champ OUI/NON non remplis (volontairement) : le bouton 'Suivant' reste donc grise tant que tu ne les remplis pas toi-meme, c'est normal.");
        break;
      }

      const advanced = await clickSuivant();
      if (!advanced) break;
      await handleDialogs();
    }
  }

  main();
})();
