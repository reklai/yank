import browser from "webextension-polyfill";
import { getSettings, patchSettings } from "../../lib/adapters/runtime/yankApi";

type JsonToolingPopupMode = "off" | "mode1" | "mode2" | "mode3";

function resolveJsonToolingPopupMode(settings: JsonToolingSettings): JsonToolingPopupMode {
  if (settings.prettyPrintEnabled) return "mode1";
  if (settings.decorateJsonBlocks) return "mode2";
  if (settings.tableFromArrayEnabled) return "mode3";
  return "off";
}

function buildJsonToolingPatch(
  current: JsonToolingSettings,
  mode: JsonToolingPopupMode,
): JsonToolingSettings {
  return {
    ...current,
    prettyPrintEnabled: mode === "mode1",
    decorateJsonBlocks: mode === "mode2",
    tableFromArrayEnabled: mode === "mode3",
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  let settings = await getSettings();

  const autoCopyToggle = document.getElementById("autoCopyToggle") as HTMLInputElement;
  const appendModeToggle = document.getElementById("appendModeToggle") as HTMLInputElement;
  const jsonToolingModeSelect = document.getElementById("jsonToolingModeSelect") as HTMLSelectElement;

  autoCopyToggle.checked = settings.autoCopy.enabled;
  appendModeToggle.checked = settings.autoCopy.appendMode;
  jsonToolingModeSelect.value = resolveJsonToolingPopupMode(settings.jsonTooling);

  autoCopyToggle.addEventListener("change", async () => {
    await patchSettings({
      autoCopy: {
        ...settings.autoCopy,
        enabled: autoCopyToggle.checked,
      },
    });
    settings = await getSettings();
    autoCopyToggle.checked = settings.autoCopy.enabled;
  });

  appendModeToggle.addEventListener("change", async () => {
    await patchSettings({
      autoCopy: {
        ...settings.autoCopy,
        appendMode: appendModeToggle.checked,
      },
    });
    settings = await getSettings();
    appendModeToggle.checked = settings.autoCopy.appendMode;
  });

  jsonToolingModeSelect.addEventListener("change", async () => {
    const mode = jsonToolingModeSelect.value as JsonToolingPopupMode;
    await patchSettings({
      jsonTooling: buildJsonToolingPatch(settings.jsonTooling, mode),
    });
    settings = await getSettings();
    jsonToolingModeSelect.value = resolveJsonToolingPopupMode(settings.jsonTooling);
  });

  const optionsBtn = document.getElementById("optionsBtn") as HTMLButtonElement;
  optionsBtn.addEventListener("click", async () => {
    await browser.runtime.openOptionsPage();
  });
});
