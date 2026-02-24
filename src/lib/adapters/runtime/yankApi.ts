import { sendRuntimeMessage } from "./runtimeClient";

async function expectOk(response: Awaited<ReturnType<typeof sendRuntimeMessage>>): Promise<void> {
  if (response.ok) return;
  throw new Error(response.reason);
}

export async function getSettings(): Promise<YankSettings> {
  const response = await sendRuntimeMessage({ type: "GET_SETTINGS" });
  if (!response.ok || !("settings" in response)) {
    throw new Error(response.ok ? "Invalid GET_SETTINGS response" : response.reason);
  }
  return response.settings;
}

export async function patchSettings(patch: Partial<YankSettings>): Promise<void> {
  const response = await sendRuntimeMessage({ type: "PATCH_SETTINGS", patch });
  await expectOk(response);
}

export async function notifyContentReady(): Promise<void> {
  const response = await sendRuntimeMessage({ type: "CONTENT_READY" });
  await expectOk(response);
}
