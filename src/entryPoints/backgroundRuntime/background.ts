import browser from "webextension-polyfill";
import { YankDomain } from "../../lib/backgroundRuntime/domains/yankDomain";
import { registerCommandRouter } from "../../lib/backgroundRuntime/handlers/commandRouter";
import { registerRuntimeRouter } from "../../lib/backgroundRuntime/handlers/runtimeRouter";
import { ensureContentScriptInjectedInOpenTabs } from "../../lib/backgroundRuntime/utils/contentScriptInjection";

const domain = new YankDomain();
const domainReady = domain.init();

registerRuntimeRouter(domain, domainReady);
registerCommandRouter(domain);

function scheduleOpenTabsInjection(reason: "install" | "startup"): void {
  void domainReady
    .then(() => ensureContentScriptInjectedInOpenTabs())
    .catch((error) => {
      console.warn(`[Yank] content injection on ${reason} failed:`, error);
    });
}

browser.runtime.onInstalled.addListener(() => {
  scheduleOpenTabsInjection("install");
});

browser.runtime.onStartup.addListener(() => {
  scheduleOpenTabsInjection("startup");
});

void domainReady.catch((error) => {
  console.error("[Yank] Background bootstrap failed:", error);
});
