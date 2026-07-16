function getSelected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

const prodNotice = document.getElementById("prod-notice");
function updateProdNotice() {
  prodNotice.style.display = getSelected("env") === "prod-souscrire" ? "block" : "none";
}
document.querySelectorAll('input[name="env"]').forEach((el) => el.addEventListener("change", updateProdNotice));
updateProdNotice();

document.getElementById("launch").addEventListener("click", () => {
  const environment = getSelected("env");
  const cardChoice = getSelected("card");
  const person = getSelected("person");
  chrome.runtime.sendMessage({ type: "START_FLOW", environment, cardChoice, person });
  window.close();
});

document.getElementById("settings-link").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
