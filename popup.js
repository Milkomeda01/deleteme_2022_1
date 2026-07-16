function getSelected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

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
