var t = document.getElementById("api-key"),
  n = document.getElementById("toggle-key"),
  l = document.getElementById("save-key"),
  o = document.getElementById("key-status"),
  i = document.getElementById("max-sources"),
  u = document.getElementById("max-babies"),
  d = document.getElementById("save-settings"),
  r = document.getElementById("settings-status");
async function m() {
  let e = await chrome.storage.local.get(["apiKey", "maxSourcesPerSide", "maxBabiesPerSource"]);
  (e.apiKey &&
    ((t.value =
      "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"),
    (t.dataset.hasKey = "true")),
    e.maxSourcesPerSide && (i.value = String(e.maxSourcesPerSide)),
    e.maxBabiesPerSource && (u.value = String(e.maxBabiesPerSource)));
}
l.addEventListener("click", async () => {
  let e = t.value.trim();
  if (
    e ===
      "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" ||
    !e
  ) {
    a(o, "Please enter a valid API key", "error");
    return;
  }
  if (!e.startsWith("sk-ant-")) {
    a(o, "API key should start with sk-ant-", "error");
    return;
  }
  (await chrome.storage.local.set({ apiKey: e }),
    a(o, "API key saved", "success"),
    (t.value =
      "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"),
    (t.dataset.hasKey = "true"),
    (t.type = "password"),
    (n.textContent = "show"));
});
n.addEventListener("click", async () => {
  if (t.type === "password") {
    if (
      t.dataset.hasKey === "true" &&
      t.value ===
        "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
    ) {
      let e = await chrome.storage.local.get(["apiKey"]);
      e.apiKey && (t.value = e.apiKey);
    }
    ((t.type = "text"), (n.textContent = "hide"));
  } else ((t.type = "password"), (n.textContent = "show"));
});
t.addEventListener("focus", () => {
  t.value ===
    "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" &&
    (t.value = "");
});
d.addEventListener("click", async () => {
  let e = parseInt(i.value, 10),
    s = parseInt(u.value, 10);
  if (isNaN(e) || e < 1 || e > 20) {
    a(r, "Max sources must be between 1 and 20", "error");
    return;
  }
  if (isNaN(s) || s < 1 || s > 10) {
    a(r, "Max babies must be between 1 and 10", "error");
    return;
  }
  (await chrome.storage.local.set({ maxSourcesPerSide: e, maxBabiesPerSource: s }),
    a(r, "Settings saved", "success"));
});
function a(e, s, c) {
  ((e.textContent = s),
    (e.className = `status ${c}`),
    (e.style.display = "block"),
    setTimeout(() => {
      e.style.display = "none";
    }, 3e3));
}
m();
