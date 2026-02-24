import browser from "webextension-polyfill";
import { YankDomain } from "../domains/yankDomain";
import { sendMessageToActiveTabWithInjectionFallback } from "../utils/contentScriptInjection";

export function registerCommandRouter(_domain: YankDomain): void {
  browser.commands.onCommand.addListener(async (command: string) => {
    if (command === "copy-page-url") {
      await sendMessageToActiveTabWithInjectionFallback({ type: "RUN_COPY_PAGE_URL" });
    }
  });
}
