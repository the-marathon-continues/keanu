// =============================================================================
// Service Worker: The brain that orchestrates research
// =============================================================================

import { runPipeline } from "../research/pipeline.js";
import type { ExtensionMessage, ResearchSession, Source, Baby } from "../shared/types.js";

// =============================================================================
// State
// =============================================================================

let currentSession: ResearchSession | null = null;

// =============================================================================
// Session Management
// =============================================================================

function createSession(query: string): ResearchSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    query,
    status: "planning",
    thesisSources: [],
    antithesisSources: [],
    thesisBabies: [],
    antithesisBabies: [],
    disagreements: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function saveSession(session: ResearchSession): Promise<void> {
  await chrome.storage.local.set({ currentSession: session });
  currentSession = session;

  // Notify side panel
  chrome.runtime.sendMessage({
    type: "SESSION_UPDATE",
    session,
  });
}

async function loadSession(): Promise<ResearchSession | null> {
  const result = await chrome.storage.local.get(["currentSession"]);
  currentSession = result.currentSession || null;
  return currentSession;
}

// =============================================================================
// Content Extraction
// =============================================================================

async function extractFromTab(tabId: number): Promise<Source | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE" });

    if (response?.type === "PAGE_EXTRACTED") {
      return {
        url: response.url,
        title: response.title,
        content: response.content,
        visitedAt: new Date().toISOString(),
        babies: [],
      };
    }
  } catch (error) {
    console.error("[keanu] Failed to extract from tab:", error);
  }

  return null;
}

// =============================================================================
// Baby Saving (calls LLM)
// =============================================================================

async function saveBabiesFromSource(
  source: Source,
  side: "thesis" | "antithesis",
): Promise<Baby[]> {
  // Get API key from storage
  const { apiKey } = await chrome.storage.local.get(["apiKey"]);

  if (!apiKey) {
    console.error("[keanu] No API key configured");
    return [];
  }

  // TODO: Call LLM with baby-saving prompt
  // For now, return empty array
  console.log("[keanu] Would extract babies from:", source.title, "side:", side);

  return [];
}

// =============================================================================
// Message Handling
// =============================================================================

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "PAGE_EXTRACTED":
      handlePageExtracted(message);
      break;

    case "START_RESEARCH":
      handleStartResearch(message.query);
      break;

    case "SAVE_BABY":
      handleSaveBaby(message.source, message.side).then(sendResponse);
      return true; // Async response

    default:
      break;
  }

  return false;
});

async function handlePageExtracted(message: {
  url: string;
  title: string;
  content: string;
}): Promise<void> {
  console.log("[keanu] Page extracted:", message.title);

  // If we have an active session in assist mode, add to sources
  if (currentSession && currentSession.status !== "complete") {
    // TODO: Add to appropriate side based on user tagging
  }
}

async function handleStartResearch(query: string): Promise<void> {
  console.log("[keanu] Starting research:", query);

  // Get API key from storage
  const { apiKey } = await chrome.storage.local.get(["apiKey"]);

  if (!apiKey) {
    console.error("[keanu] No API key configured. Set one in extension options.");
    return;
  }

  // Run the full 9-node dialectical research pipeline
  await runPipeline(
    query,
    {
      apiKey,
      maxSourcesPerSide: 5,
      maxBabiesPerSource: 5,
    },
    async (session) => {
      // Save and broadcast updates as the pipeline progresses
      await saveSession(session);
    },
  );
}

async function handleSaveBaby(source: Source, side: "thesis" | "antithesis"): Promise<Baby[]> {
  const babies = await saveBabiesFromSource(source, side);

  if (currentSession) {
    if (side === "thesis") {
      currentSession.thesisBabies.push(...babies);
    } else {
      currentSession.antithesisBabies.push(...babies);
    }
    currentSession.updatedAt = new Date().toISOString();
    await saveSession(currentSession);
  }

  return babies;
}

// =============================================================================
// Side Panel Toggle
// =============================================================================

chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel when the extension icon is clicked
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// =============================================================================
// Initialization
// =============================================================================

async function init() {
  await loadSession();
  console.log("[keanu] Service worker initialized");
}

init();
