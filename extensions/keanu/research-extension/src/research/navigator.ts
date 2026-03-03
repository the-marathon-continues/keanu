// =============================================================================
// Navigator: Browser automation for dialectical research
// =============================================================================
//
// Opens tabs, searches Google, clicks through results.
// The eyes and hands of the research agent.

import type { Source } from "../shared/types.js";

// =============================================================================
// Types
// =============================================================================

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface NavigatorConfig {
  maxResults: number; // Max results per search
  waitBetweenPages: number; // Ms to wait between page loads
  timeout: number; // Max ms to wait for page load
}

const DEFAULT_CONFIG: NavigatorConfig = {
  maxResults: 5,
  waitBetweenPages: 2000,
  timeout: 30000,
};

// =============================================================================
// Google Search
// =============================================================================

/**
 * Build a Google search URL.
 */
function buildSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encoded}`;
}

/**
 * Open a Google search in a new tab and extract results.
 */
export async function searchGoogle(
  query: string,
  config: Partial<NavigatorConfig> = {},
): Promise<SearchResult[]> {
  const { maxResults } = { ...DEFAULT_CONFIG, ...config };

  // Create a new tab with the search
  const tab = await chrome.tabs.create({
    url: buildSearchUrl(query),
    active: false, // Don't steal focus
  });

  if (!tab.id) throw new Error("Failed to create tab");

  // Wait for page to load
  await waitForTab(tab.id);

  // Extract search results from the page
  const results = await extractSearchResults(tab.id, maxResults);

  // Close the search tab
  await chrome.tabs.remove(tab.id);

  return results;
}

/**
 * Extract search results from a Google search page.
 */
async function extractSearchResults(tabId: number, maxResults: number): Promise<SearchResult[]> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (max: number) => {
      const results: { title: string; url: string; snippet: string }[] = [];

      // Google's search result selectors (may need updates as Google changes)
      const resultElements = document.querySelectorAll("div.g");

      for (let i = 0; i < Math.min(resultElements.length, max); i++) {
        const el = resultElements[i];

        const linkEl = el.querySelector("a");
        const titleEl = el.querySelector("h3");
        const snippetEl = el.querySelector("div[data-sncf]") || el.querySelector("div.VwiC3b");

        if (linkEl && titleEl) {
          results.push({
            title: titleEl.textContent || "",
            url: linkEl.href,
            snippet: snippetEl?.textContent || "",
          });
        }
      }

      return results;
    },
    args: [maxResults],
  });

  return results[0]?.result || [];
}

// =============================================================================
// Page Navigation
// =============================================================================

/**
 * Open a URL in a new tab and extract content.
 */
export async function visitPage(
  url: string,
  config: Partial<NavigatorConfig> = {},
): Promise<Source | null> {
  const { timeout } = { ...DEFAULT_CONFIG, ...config };

  const tab = await chrome.tabs.create({
    url,
    active: false,
  });

  if (!tab.id) return null;

  try {
    // Wait for page to load
    await waitForTab(tab.id, timeout);

    // Request content extraction from content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE" });

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
    console.error("[navigator] Failed to visit page:", url, error);
  } finally {
    // Always close the tab
    await chrome.tabs.remove(tab.id);
  }

  return null;
}

/**
 * Visit multiple URLs and extract content from each.
 */
export async function visitPages(
  urls: string[],
  config: Partial<NavigatorConfig> = {},
): Promise<Source[]> {
  const { waitBetweenPages } = { ...DEFAULT_CONFIG, ...config };
  const sources: Source[] = [];

  for (const url of urls) {
    const source = await visitPage(url, config);
    if (source) {
      sources.push(source);
    }

    // Wait between pages to avoid rate limiting
    if (waitBetweenPages > 0) {
      await sleep(waitBetweenPages);
    }
  }

  return sources;
}

// =============================================================================
// Adversarial Query Generation (FVA-RAG "Kill Queries")
// =============================================================================

/**
 * Generate adversarial queries to find counter-evidence.
 *
 * These are "kill queries" — designed to surface negations, retractions,
 * and contradictory evidence. The FVA-RAG paper showed this improves
 * factual accuracy by ~10% on TruthfulQA.
 */
export function generateKillQueries(thesisQuery: string): string[] {
  const queries: string[] = [];

  // Direct criticism patterns
  queries.push(`criticism of ${thesisQuery}`);
  queries.push(`problems with ${thesisQuery}`);
  queries.push(`${thesisQuery} debunked`);
  queries.push(`${thesisQuery} wrong`);

  // Alternative viewpoints
  queries.push(`alternative to ${thesisQuery}`);
  queries.push(`${thesisQuery} controversy`);

  // Negation patterns
  const negated = negateQuery(thesisQuery);
  if (negated) {
    queries.push(negated);
  }

  return queries;
}

/**
 * Attempt to negate a query.
 */
function negateQuery(query: string): string | null {
  // Simple negation patterns
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes(" is ")) {
    return query.replace(/ is /gi, " is not ");
  }
  if (lowerQuery.includes(" are ")) {
    return query.replace(/ are /gi, " are not ");
  }
  if (lowerQuery.includes(" should ")) {
    return query.replace(/ should /gi, " should not ");
  }
  if (lowerQuery.includes(" will ")) {
    return query.replace(/ will /gi, " will not ");
  }
  if (lowerQuery.includes(" can ")) {
    return query.replace(/ can /gi, " cannot ");
  }
  if (lowerQuery.includes(" does ")) {
    return query.replace(/ does /gi, " does not ");
  }

  // Can't negate, return null
  return null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Wait for a tab to finish loading.
 */
async function waitForTab(tabId: number, timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkLoaded = async () => {
      const tab = await chrome.tabs.get(tabId);

      if (tab.status === "complete") {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error("Tab load timeout"));
        return;
      }

      setTimeout(checkLoaded, 100);
    };

    checkLoaded();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
