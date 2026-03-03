var p = document.getElementById("query-input"),
  E = document.getElementById("start-research"),
  s = document.getElementById("status"),
  n = document.getElementById("research-mode"),
  i = document.getElementById("assist-mode"),
  o = document.getElementById("thesis-section"),
  d = document.getElementById("antithesis-section"),
  u = document.getElementById("disagreements-section"),
  m = document.getElementById("synthesis-section"),
  h = document.getElementById("thesis-babies"),
  y = document.getElementById("antithesis-babies"),
  g = document.getElementById("disagreements"),
  L = document.getElementById("synthesis"),
  r = "research",
  a = null;
function v(e) {
  let t = document.createElement("div");
  return (
    (t.className = `baby ${e.side}`),
    (t.innerHTML = `
    <div class="baby-observation">${c(e.observation)}</div>
    <div class="baby-meta">
      ${e.evidenceBasis}
      <span class="baby-distinctiveness">${Math.round(e.distinctiveness * 100)}% unique</span>
    </div>
  `),
    t
  );
}
function M(e) {
  let t = document.createElement("div");
  return (
    (t.className = "disagreement"),
    (t.innerHTML = `
    <div class="disagreement-type">${e.type}</div>
    <div>${c(e.axis)}</div>
  `),
    t
  );
}
function f(e) {
  if (
    ((s.textContent = S(e.status)),
    (s.className = `status ${e.status !== "complete" && e.status !== "failed" ? "active" : ""}`),
    e.thesisBabies.length > 0
      ? ((o.style.display = "block"),
        (h.innerHTML = ""),
        e.thesisBabies.forEach((t) => {
          h.appendChild(v(t));
        }))
      : (o.style.display = "none"),
    e.antithesisBabies.length > 0
      ? ((d.style.display = "block"),
        (y.innerHTML = ""),
        e.antithesisBabies.forEach((t) => {
          y.appendChild(v(t));
        }))
      : (d.style.display = "none"),
    e.disagreements.length > 0
      ? ((u.style.display = "block"),
        (g.innerHTML = ""),
        e.disagreements.forEach((t) => {
          g.appendChild(M(t));
        }))
      : (u.style.display = "none"),
    e.synthesis)
  ) {
    m.style.display = "block";
    let t = "";
    (e.synthesis.aliveState &&
      (t = `
        <div class="helix-score" style="margin-top: 8px; font-size: 12px;">
          <span style="color: ${B(e.synthesis.aliveState)}; font-weight: 600;">${e.synthesis.aliveState.toUpperCase()}</span>
          ${
            e.synthesis.helixScore
              ? `
            <span style="color: #666; margin-left: 8px;">
              F:${(e.synthesis.helixScore.factual * 100).toFixed(0)}%
              M:${(e.synthesis.helixScore.felt * 100).toFixed(0)}%
            </span>
          `
              : ""
          }
        </div>
      `),
      (L.innerHTML = `
      <div class="synthesis-statement">${c(e.synthesis.statement)}</div>
      ${t}
    `));
  } else m.style.display = "none";
}
function B(e) {
  switch (e) {
    case "alive":
      return "#228B22";
    case "luminous":
      return "#FFD700";
    case "dark":
      return "#8B0000";
    case "grey":
      return "#808080";
    case "black":
      return "#1a1a1a";
    case "silver":
      return "#C0C0C0";
    default:
      return "#666";
  }
}
function S(e) {
  switch (e) {
    case "planning":
      return "Planning research...";
    case "searching_thesis":
      return "Searching for thesis sources...";
    case "searching_antithesis":
      return "Searching for counter-evidence...";
    case "extracting":
      return "Saving babies from sources...";
    case "classifying":
      return "Classifying disagreements...";
    case "synthesizing":
      return "Synthesizing (preserving babies)...";
    case "grading":
      return "Scoring quality, tracking claims...";
    case "complete":
      return "Research complete";
    case "failed":
      return "Research failed";
    default:
      return "Ready to research";
  }
}
function c(e) {
  let t = document.createElement("div");
  return ((t.textContent = e), t.innerHTML);
}
E.addEventListener("click", async () => {
  let e = p.value.trim();
  e &&
    ((s.textContent = "Starting research..."),
    (s.className = "status active"),
    await chrome.runtime.sendMessage({ type: "START_RESEARCH", query: e }));
});
p.addEventListener("keypress", (e) => {
  e.key === "Enter" && E.click();
});
n.addEventListener("click", () => {
  ((r = "research"),
    n.classList.add("active"),
    i.classList.remove("active"),
    chrome.storage.local.set({ assistMode: !1 }));
});
i.addEventListener("click", () => {
  ((r = "assist"),
    i.classList.add("active"),
    n.classList.remove("active"),
    chrome.storage.local.set({ assistMode: !0 }));
});
chrome.runtime.onMessage.addListener((e) => {
  e.type === "SESSION_UPDATE" && ((a = e.session), f(e.session));
});
async function b() {
  let e = await chrome.storage.local.get(["currentSession", "assistMode", "apiKey"]);
  (e.apiKey ||
    ((s.innerHTML =
      'No API key configured. <a href="#" id="open-settings" style="color: #228b22;">Open settings</a>'),
    (s.className = "status"),
    document.getElementById("open-settings")?.addEventListener("click", (l) => {
      (l.preventDefault(), chrome.runtime.openOptionsPage());
    })),
    e.currentSession && ((a = e.currentSession), f(a)),
    e.assistMode && ((r = "assist"), i.classList.add("active"), n.classList.remove("active")));
}
b();
