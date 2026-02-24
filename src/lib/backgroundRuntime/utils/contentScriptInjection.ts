import browser from "webextension-polyfill";
import { ContentRuntimeMessage } from "../../common/contracts/runtimeMessages";

const CONTENT_SCRIPT_FILE = "contentScript.js";
const RETRY_DELAYS_MS = [0, 80, 180, 320];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTabUrl(tab: browser.Tabs.Tab): string {
  if (typeof tab.url === "string") return tab.url;
  const pending = (tab as browser.Tabs.Tab & { pendingUrl?: string }).pendingUrl;
  return typeof pending === "string" ? pending : "";
}

function isInjectableTab(tab: browser.Tabs.Tab): boolean {
  if (tab.id == null) return false;

  const url = getTabUrl(tab).toLowerCase();
  if (!url) return false;

  const blockedSchemes = [
    "about:",
    "chrome:",
    "chrome-extension:",
    "moz-extension:",
    "edge:",
    "resource:",
    "view-source:",
    "devtools:",
  ];

  for (const scheme of blockedSchemes) {
    if (url.startsWith(scheme)) return false;
  }

  return url.startsWith("http:") || url.startsWith("https:") || url.startsWith("file:");
}

export async function injectContentScriptIntoTab(tabId: number): Promise<boolean> {
  try {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: [CONTENT_SCRIPT_FILE],
      });
      return true;
    } catch {
      await browser.tabs.executeScript(tabId, {
        file: CONTENT_SCRIPT_FILE,
        runAt: "document_idle",
      });
      return true;
    }
  } catch {
    return false;
  }
}

export async function ensureContentScriptInjectedInOpenTabs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (!isInjectableTab(tab) || tab.id == null) continue;
    await injectContentScriptIntoTab(tab.id);
  }
}

async function sendMessageWithRetries(
  tabId: number,
  message: ContentRuntimeMessage,
): Promise<boolean> {
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    try {
      await browser.tabs.sendMessage(tabId, message);
      return true;
    } catch {
      // Retry while script initializes.
    }
  }
  return false;
}

export async function sendMessageToActiveTabWithInjectionFallback(
  message: ContentRuntimeMessage,
): Promise<boolean> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || activeTab.id == null) return false;

  if (await sendMessageWithRetries(activeTab.id, message)) {
    return true;
  }

  if (!isInjectableTab(activeTab)) {
    return false;
  }

  const injected = await injectContentScriptIntoTab(activeTab.id);
  if (!injected) return false;

  return sendMessageWithRetries(activeTab.id, message);
}
