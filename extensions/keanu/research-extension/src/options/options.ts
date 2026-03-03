// =============================================================================
// Options: Where you configure the research engine
// =============================================================================

// =============================================================================
// DOM Elements
// =============================================================================

const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const toggleKey = document.getElementById("toggle-key") as HTMLSpanElement;
const saveKeyButton = document.getElementById("save-key") as HTMLButtonElement;
const keyStatus = document.getElementById("key-status") as HTMLDivElement;

const maxSourcesInput = document.getElementById("max-sources") as HTMLInputElement;
const maxBabiesInput = document.getElementById("max-babies") as HTMLInputElement;
const saveSettingsButton = document.getElementById("save-settings") as HTMLButtonElement;
const settingsStatus = document.getElementById("settings-status") as HTMLDivElement;

// =============================================================================
// Load Existing Settings
// =============================================================================

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get([
    "apiKey",
    "maxSourcesPerSide",
    "maxBabiesPerSource",
  ]);

  if (result.apiKey) {
    // Show masked version
    apiKeyInput.value = "••••••••••••••••";
    apiKeyInput.dataset.hasKey = "true";
  }

  if (result.maxSourcesPerSide) {
    maxSourcesInput.value = String(result.maxSourcesPerSide);
  }

  if (result.maxBabiesPerSource) {
    maxBabiesInput.value = String(result.maxBabiesPerSource);
  }
}

// =============================================================================
// Save API Key
// =============================================================================

saveKeyButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();

  // Don't save if it's the masked placeholder
  if (apiKey === "••••••••••••••••" || !apiKey) {
    showStatus(keyStatus, "Please enter a valid API key", "error");
    return;
  }

  // Basic validation
  if (!apiKey.startsWith("sk-ant-")) {
    showStatus(keyStatus, "API key should start with sk-ant-", "error");
    return;
  }

  await chrome.storage.local.set({ apiKey });
  showStatus(keyStatus, "API key saved", "success");

  // Mask the key after saving
  apiKeyInput.value = "••••••••••••••••";
  apiKeyInput.dataset.hasKey = "true";
  apiKeyInput.type = "password";
  toggleKey.textContent = "show";
});

// =============================================================================
// Toggle Key Visibility
// =============================================================================

toggleKey.addEventListener("click", async () => {
  if (apiKeyInput.type === "password") {
    // Show the key (if we have one stored and it's masked)
    if (apiKeyInput.dataset.hasKey === "true" && apiKeyInput.value === "••••••••••••••••") {
      const result = await chrome.storage.local.get(["apiKey"]);
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    }
    apiKeyInput.type = "text";
    toggleKey.textContent = "hide";
  } else {
    apiKeyInput.type = "password";
    toggleKey.textContent = "show";
  }
});

// Clear the masked placeholder when user starts typing
apiKeyInput.addEventListener("focus", () => {
  if (apiKeyInput.value === "••••••••••••••••") {
    apiKeyInput.value = "";
  }
});

// =============================================================================
// Save Research Settings
// =============================================================================

saveSettingsButton.addEventListener("click", async () => {
  const maxSourcesPerSide = parseInt(maxSourcesInput.value, 10);
  const maxBabiesPerSource = parseInt(maxBabiesInput.value, 10);

  if (isNaN(maxSourcesPerSide) || maxSourcesPerSide < 1 || maxSourcesPerSide > 20) {
    showStatus(settingsStatus, "Max sources must be between 1 and 20", "error");
    return;
  }

  if (isNaN(maxBabiesPerSource) || maxBabiesPerSource < 1 || maxBabiesPerSource > 10) {
    showStatus(settingsStatus, "Max babies must be between 1 and 10", "error");
    return;
  }

  await chrome.storage.local.set({ maxSourcesPerSide, maxBabiesPerSource });
  showStatus(settingsStatus, "Settings saved", "success");
});

// =============================================================================
// Status Display
// =============================================================================

function showStatus(element: HTMLDivElement, message: string, type: "success" | "error"): void {
  element.textContent = message;
  element.className = `status ${type}`;
  element.style.display = "block";

  // Auto-hide after 3 seconds
  setTimeout(() => {
    element.style.display = "none";
  }, 3000);
}

// =============================================================================
// Initialize
// =============================================================================

loadSettings();
