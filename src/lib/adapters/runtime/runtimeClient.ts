import browser from "webextension-polyfill";
import { RuntimeMessage, RuntimeResponse } from "../../common/contracts/runtimeMessages";

export async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return (await browser.runtime.sendMessage(message)) as RuntimeResponse;
}
