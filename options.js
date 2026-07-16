const DEFAULT_FIRSTNAME = "Emile";
const DEFAULT_LASTNAME = "Cartier";

const firstnameInput = document.getElementById("firstname");
const lastnameInput = document.getElementById("lastname");
const statusEl = document.getElementById("status");

async function load() {
  const { myFirstName, myLastName } = await chrome.storage.sync.get(["myFirstName", "myLastName"]);
  firstnameInput.value = myFirstName || DEFAULT_FIRSTNAME;
  lastnameInput.value = myLastName || DEFAULT_LASTNAME;
}

async function save() {
  const myFirstName = firstnameInput.value.trim() || DEFAULT_FIRSTNAME;
  const myLastName = lastnameInput.value.trim() || DEFAULT_LASTNAME;
  await chrome.storage.sync.set({ myFirstName, myLastName });
  statusEl.textContent = "Enregistre.";
  setTimeout(() => (statusEl.textContent = ""), 2000);
}

document.getElementById("save").addEventListener("click", save);
load();
