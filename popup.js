function start(cardChoice) {
  chrome.runtime.sendMessage({ type: "START_FLOW", cardChoice });
  window.close();
}

document.getElementById("btn-cdiscount").addEventListener("click", () => start("cdiscount"));
document.getElementById("btn-cdiscount-cla").addEventListener("click", () => start("cdiscount_cla"));
