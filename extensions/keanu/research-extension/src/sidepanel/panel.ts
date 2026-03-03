// =============================================================================
// Side Panel: Research session UI
// =============================================================================

import type { ResearchSession, Baby, ClassifiedDisagreement } from "../shared/types.js";

// =============================================================================
// DOM Elements
// =============================================================================

const queryInput = document.getElementById("query-input") as HTMLInputElement;
const startButton = document.getElementById("start-research") as HTMLButtonElement;
const statusDiv = document.getElementById("status") as HTMLDivElement;
const researchModeButton = document.getElementById("research-mode") as HTMLButtonElement;
const assistModeButton = document.getElementById("assist-mode") as HTMLButtonElement;

const thesisSection = document.getElementById("thesis-section") as HTMLDivElement;
const antithesisSection = document.getElementById("antithesis-section") as HTMLDivElement;
const disagreementsSection = document.getElementById("disagreements-section") as HTMLDivElement;
const synthesisSection = document.getElementById("synthesis-section") as HTMLDivElement;

const thesisBabiesDiv = document.getElementById("thesis-babies") as HTMLDivElement;
const antithesisBabiesDiv = document.getElementById("antithesis-babies") as HTMLDivElement;
const disagreementsDiv = document.getElementById("disagreements") as HTMLDivElement;
const synthesisDiv = document.getElementById("synthesis") as HTMLDivElement;

// =============================================================================
// State
// =============================================================================

let currentMode: "research" | "assist" = "research";
let currentSession: ResearchSession | null = null;

// =============================================================================
// Rendering
// =============================================================================

function renderBaby(baby: Baby): HTMLElement {
  const div = document.createElement("div");
  div.className = `baby ${baby.side}`;
  div.innerHTML = `
    <div class="baby-observation">${escapeHtml(baby.observation)}</div>
    <div class="baby-meta">
      ${baby.evidenceBasis}
      <span class="baby-distinctiveness">${Math.round(baby.distinctiveness * 100)}% unique</span>
    </div>
  `;
  return div;
}

function renderDisagreement(disagreement: ClassifiedDisagreement): HTMLElement {
  const div = document.createElement("div");
  div.className = "disagreement";
  div.innerHTML = `
    <div class="disagreement-type">${disagreement.type}</div>
    <div>${escapeHtml(disagreement.axis)}</div>
  `;
  return div;
}

function renderSession(session: ResearchSession): void {
  // Update status
  statusDiv.textContent = getStatusText(session.status);
  statusDiv.className = `status ${session.status !== "complete" && session.status !== "failed" ? "active" : ""}`;

  // Render thesis babies
  if (session.thesisBabies.length > 0) {
    thesisSection.style.display = "block";
    thesisBabiesDiv.innerHTML = "";
    session.thesisBabies.forEach((baby) => {
      thesisBabiesDiv.appendChild(renderBaby(baby));
    });
  } else {
    thesisSection.style.display = "none";
  }

  // Render antithesis babies
  if (session.antithesisBabies.length > 0) {
    antithesisSection.style.display = "block";
    antithesisBabiesDiv.innerHTML = "";
    session.antithesisBabies.forEach((baby) => {
      antithesisBabiesDiv.appendChild(renderBaby(baby));
    });
  } else {
    antithesisSection.style.display = "none";
  }

  // Render disagreements
  if (session.disagreements.length > 0) {
    disagreementsSection.style.display = "block";
    disagreementsDiv.innerHTML = "";
    session.disagreements.forEach((d) => {
      disagreementsDiv.appendChild(renderDisagreement(d));
    });
  } else {
    disagreementsSection.style.display = "none";
  }

  // Render synthesis
  if (session.synthesis) {
    synthesisSection.style.display = "block";

    // Show helix score if available
    let helixHtml = "";
    if (session.synthesis.aliveState) {
      const stateColor = getStateColor(session.synthesis.aliveState);
      helixHtml = `
        <div class="helix-score" style="margin-top: 8px; font-size: 12px;">
          <span style="color: ${stateColor}; font-weight: 600;">${session.synthesis.aliveState.toUpperCase()}</span>
          ${
            session.synthesis.helixScore
              ? `
            <span style="color: #666; margin-left: 8px;">
              F:${(session.synthesis.helixScore.factual * 100).toFixed(0)}%
              M:${(session.synthesis.helixScore.felt * 100).toFixed(0)}%
            </span>
          `
              : ""
          }
        </div>
      `;
    }

    synthesisDiv.innerHTML = `
      <div class="synthesis-statement">${escapeHtml(session.synthesis.statement)}</div>
      ${helixHtml}
    `;
  } else {
    synthesisSection.style.display = "none";
  }
}

function getStateColor(state: string): string {
  switch (state) {
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

function getStatusText(status: ResearchSession["status"]): string {
  switch (status) {
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

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// =============================================================================
// Event Handlers
// =============================================================================

startButton.addEventListener("click", async () => {
  const query = queryInput.value.trim();
  if (!query) return;

  statusDiv.textContent = "Starting research...";
  statusDiv.className = "status active";

  await chrome.runtime.sendMessage({
    type: "START_RESEARCH",
    query,
  });
});

queryInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    startButton.click();
  }
});

researchModeButton.addEventListener("click", () => {
  currentMode = "research";
  researchModeButton.classList.add("active");
  assistModeButton.classList.remove("active");
  chrome.storage.local.set({ assistMode: false });
});

assistModeButton.addEventListener("click", () => {
  currentMode = "assist";
  assistModeButton.classList.add("active");
  researchModeButton.classList.remove("active");
  chrome.storage.local.set({ assistMode: true });
});

// =============================================================================
// Message Handling
// =============================================================================

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_UPDATE") {
    currentSession = message.session;
    renderSession(message.session);
  }
});

// =============================================================================
// Initialization
// =============================================================================

async function init() {
  // Load current session
  const result = await chrome.storage.local.get(["currentSession", "assistMode", "apiKey"]);

  // Check API key status
  if (!result.apiKey) {
    statusDiv.innerHTML = `No API key configured. <a href="#" id="open-settings" style="color: #228b22;">Open settings</a>`;
    statusDiv.className = "status";

    // Add click handler for settings link
    const settingsLink = document.getElementById("open-settings");
    settingsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  if (result.currentSession) {
    currentSession = result.currentSession;
    renderSession(currentSession);
  }

  if (result.assistMode) {
    currentMode = "assist";
    assistModeButton.classList.add("active");
    researchModeButton.classList.remove("active");
  }
}

init();
