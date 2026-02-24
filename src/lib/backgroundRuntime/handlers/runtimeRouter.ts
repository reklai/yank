import browser from "webextension-polyfill";
import { RuntimeMessage } from "../../common/contracts/runtimeMessages";
import { YankDomain } from "../domains/yankDomain";

export function registerRuntimeRouter(domain: YankDomain, domainReady: Promise<void>): void {
  browser.runtime.onMessage.addListener(async (message: unknown) => {
    const runtimeMessage = message as RuntimeMessage;

    try {
      await domainReady;

      switch (runtimeMessage.type) {
        case "GET_SETTINGS":
          return { ok: true, settings: domain.getSettings() };

        case "PATCH_SETTINGS":
          await domain.patchSettings(runtimeMessage.patch);
          return { ok: true };

        case "CONTENT_READY":
          return { ok: true };

        default:
          return { ok: false, reason: "Unsupported runtime message." };
      }
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Unknown runtime error",
      };
    }
  });
}
