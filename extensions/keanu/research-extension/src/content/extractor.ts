// =============================================================================
// Content Script: Extract readable content from pages
// =============================================================================

import { Readability } from "@mozilla/readability";
import type { PageExtractedMessage } from "../shared/types.js";

/**
 * Extract readable content from the current page.
 * Uses Mozilla's Readability.js — the same thing Firefox Reader View uses.
 */
function extractPageContent(): { title: string; content: string } {
  // Clone the document so Readability doesn't modify the original
  const documentClone = document.cloneNode(true) as Document;

  try {
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (article) {
      return {
        title: article.title || document.title,
        content: article.textContent || "",
      };
    }
  } catch (error) {
    console.warn("[keanu] Readability failed, falling back to body text:", error);
  }

  // Fallback: just get body text
  return {
    title: document.title,
    content: document.body?.innerText || "",
  };
}

/**
 * Listen for extraction requests from the service worker.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXTRACT_PAGE") {
    const { title, content } = extractPageContent();

    const response: PageExtractedMessage = {
      type: "PAGE_EXTRACTED",
      url: window.location.href,
      title,
      content,
    };

    sendResponse(response);
    return true; // Will respond asynchronously
  }

  return false;
});

/**
 * Optionally auto-extract on page load for assist mode.
 * Only triggers if the side panel is open.
 */
async function maybeAutoExtract() {
  // Check if we should auto-extract (side panel open, assist mode on)
  const settings = await chrome.storage.local.get(["assistMode"]);

  if (settings.assistMode) {
    const { title, content } = extractPageContent();

    // Send to service worker
    chrome.runtime.sendMessage({
      type: "PAGE_EXTRACTED",
      url: window.location.href,
      title,
      content,
    });
  }
}

// Wait for page to be fully loaded before potentially extracting
if (document.readyState === "complete") {
  maybeAutoExtract();
} else {
  window.addEventListener("load", maybeAutoExtract);
}

console.log("[keanu] Content script loaded");
