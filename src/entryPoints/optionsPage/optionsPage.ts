import { getSettings, patchSettings } from "../../lib/adapters/runtime/yankApi";
import {
  keyboardEventToShortcutString,
  normalizeShortcutString,
} from "../../lib/common/utils/shortcuts";

const SHORTCUT_INPUT_IDS = [
  "shortcutSwitchToAutoCopy",
  "shortcutJsonToolingPrettyPrint",
  "shortcutJsonToolingPathCopy",
  "shortcutJsonToolingMarkdownTable",
  "shortcutCopyPageUrl",
  "shortcutCopyCleanCodeBlock",
] as const;

type ShortcutInputId = (typeof SHORTCUT_INPUT_IDS)[number];

const SHORTCUT_FIELD_MAP: Record<ShortcutInputId, keyof ShortcutSettings> = {
  shortcutSwitchToAutoCopy: "switchToAutoCopy",
  shortcutJsonToolingPrettyPrint: "jsonToolingPrettyPrint",
  shortcutJsonToolingPathCopy: "jsonToolingPathCopy",
  shortcutJsonToolingMarkdownTable: "jsonToolingMarkdownTable",
  shortcutCopyPageUrl: "copyPageUrl",
  shortcutCopyCleanCodeBlock: "copyCleanCodeBlock",
};

const SHORTCUT_LABELS: Record<ShortcutInputId, string> = {
  shortcutSwitchToAutoCopy: "Toggle Auto-Copy on/off",
  shortcutJsonToolingPrettyPrint: "Toggle JSON Tools: Pretty Print",
  shortcutJsonToolingPathCopy: "Toggle JSON Tools: Path Copy",
  shortcutJsonToolingMarkdownTable: "Toggle JSON Tools: Markdown Table",
  shortcutCopyPageUrl: "Copy current page URL",
  shortcutCopyCleanCodeBlock: "Copy clean code block",
};

const SHORTCUT_FIELD_LABELS: Record<keyof ShortcutSettings, string> = {
  switchToAutoCopy: SHORTCUT_LABELS.shortcutSwitchToAutoCopy,
  jsonToolingPrettyPrint: SHORTCUT_LABELS.shortcutJsonToolingPrettyPrint,
  jsonToolingPathCopy: SHORTCUT_LABELS.shortcutJsonToolingPathCopy,
  jsonToolingMarkdownTable: SHORTCUT_LABELS.shortcutJsonToolingMarkdownTable,
  copyPageUrl: SHORTCUT_LABELS.shortcutCopyPageUrl,
  copyCleanCodeBlock: SHORTCUT_LABELS.shortcutCopyCleanCodeBlock,
};

const RESERVED_HELP_MENU_SHORTCUT = "Alt+M";

type JsonToolingModeSelection = "off" | "mode1" | "mode2" | "mode3";

function resolveJsonToolingMode(settings: JsonToolingSettings): JsonToolingModeSelection {
  if (settings.prettyPrintEnabled) return "mode1";
  if (settings.decorateJsonBlocks) return "mode2";
  if (settings.tableFromArrayEnabled) return "mode3";
  return "off";
}

function buildJsonToolingModePatch(
  current: JsonToolingSettings,
  mode: JsonToolingModeSelection,
): JsonToolingSettings {
  return {
    ...current,
    prettyPrintEnabled: mode === "mode1",
    decorateJsonBlocks: mode === "mode2",
    tableFromArrayEnabled: mode === "mode3",
  };
}

interface FormRefs {
  urlShowToast: HTMLInputElement;
  urlToastDismissMs: HTMLInputElement;
  autoCopyEnabled: HTMLInputElement;
  plainTextMode: HTMLInputElement;
  appendMode: HTMLInputElement;
  sourceTagMode: HTMLInputElement;
  showSelectionCountBadge: HTMLInputElement;
  appendSeparator: HTMLInputElement;
  siteRuleMode: HTMLSelectElement;
  siteRules: HTMLTextAreaElement;
  jsonToolingModeSelect: HTMLSelectElement;
  rootPathPrefix: HTMLInputElement;
  shortcutInputs: Record<ShortcutInputId, HTMLInputElement>;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function collectShortcutRefs(): Record<ShortcutInputId, HTMLInputElement> {
  const refs = {} as Record<ShortcutInputId, HTMLInputElement>;
  for (const id of SHORTCUT_INPUT_IDS) {
    refs[id] = byId<HTMLInputElement>(id);
  }
  return refs;
}

function collectFormRefs(): FormRefs {
  return {
    urlShowToast: byId("urlShowToast"),
    urlToastDismissMs: byId("urlToastDismissMs"),
    autoCopyEnabled: byId("autoCopyEnabled"),
    plainTextMode: byId("plainTextMode"),
    appendMode: byId("appendMode"),
    sourceTagMode: byId("sourceTagMode"),
    showSelectionCountBadge: byId("showSelectionCountBadge"),
    appendSeparator: byId("appendSeparator"),
    siteRuleMode: byId("siteRuleMode"),
    siteRules: byId("siteRules"),
    jsonToolingModeSelect: byId("jsonToolingModeSelect"),
    rootPathPrefix: byId("rootPathPrefix"),
    shortcutInputs: collectShortcutRefs(),
  };
}

function showStatus(message: string, type: "success" | "error" = "success", dismissMs = 2200): void {
  const statusBar = byId<HTMLDivElement>("statusBar");
  statusBar.textContent = message;
  statusBar.className = `status-bar visible${type === "error" ? " error" : ""}`;

  if (dismissMs <= 0) return;
  window.setTimeout(() => {
    statusBar.classList.remove("visible");
  }, dismissMs);
}

function fillForm(settings: YankSettings, refs: FormRefs): void {
  refs.urlShowToast.checked = settings.urlCopy.showToast;
  refs.urlToastDismissMs.value = String(settings.urlCopy.toastDismissMs);

  refs.autoCopyEnabled.checked = settings.autoCopy.enabled;
  refs.plainTextMode.checked = settings.autoCopy.plainTextMode;
  refs.appendMode.checked = settings.autoCopy.appendMode;
  refs.sourceTagMode.checked = settings.autoCopy.sourceTagMode;
  refs.showSelectionCountBadge.checked = settings.autoCopy.showSelectionCountBadge;
  refs.appendSeparator.value = settings.autoCopy.appendSeparator;
  refs.siteRuleMode.value = settings.autoCopy.siteRuleMode;
  refs.siteRules.value = settings.autoCopy.siteRules.join("\n");

  refs.jsonToolingModeSelect.value = resolveJsonToolingMode(settings.jsonTooling);
  refs.rootPathPrefix.value = settings.jsonTooling.rootPathPrefix;

  for (const id of SHORTCUT_INPUT_IDS) {
    const field = SHORTCUT_FIELD_MAP[id];
    refs.shortcutInputs[id].value = settings.shortcuts[field];
  }
}

function collectShortcutPatch(refs: FormRefs, current: YankSettings): ShortcutSettings {
  const next: ShortcutSettings = { ...current.shortcuts };

  for (const id of SHORTCUT_INPUT_IDS) {
    const input = refs.shortcutInputs[id];
    const raw = input.value.trim();

    if (!raw) {
      next[SHORTCUT_FIELD_MAP[id]] = "";
      continue;
    }

    const normalized = normalizeShortcutString(raw);
    if (!normalized) {
      throw new Error(`Invalid shortcut: ${SHORTCUT_LABELS[id]}`);
    }

    next[SHORTCUT_FIELD_MAP[id]] = normalized;
  }

  const usedByShortcut = new Map<string, Array<keyof ShortcutSettings>>();
  const shortcutFields = Object.keys(next) as Array<keyof ShortcutSettings>;
  for (const field of shortcutFields) {
    const value = next[field];
    if (!value) continue;
    const existing = usedByShortcut.get(value);
    if (existing) {
      existing.push(field);
    } else {
      usedByShortcut.set(value, [field]);
    }
  }

  const duplicateDetails: string[] = [];
  for (const [shortcut, fields] of usedByShortcut.entries()) {
    if (fields.length < 2) continue;
    const labels = fields.map((field) => SHORTCUT_FIELD_LABELS[field]).join(" + ");
    duplicateDetails.push(`${shortcut} -> ${labels}`);
  }

  if (duplicateDetails.length > 0) {
    throw new Error(`Duplicate shortcuts are not allowed: ${duplicateDetails.join("; ")}`);
  }

  const conflictingFields = (Object.keys(next) as Array<keyof ShortcutSettings>)
    .filter((field) => next[field] === RESERVED_HELP_MENU_SHORTCUT);
  if (conflictingFields.length > 0) {
    const labels = conflictingFields.map((field) => SHORTCUT_FIELD_LABELS[field]).join(" + ");
    throw new Error(
      `${RESERVED_HELP_MENU_SHORTCUT} is reserved for Help Menu toggle. Reassign: ${labels}`,
    );
  }

  return next;
}

function collectPatch(refs: FormRefs, current: YankSettings): Partial<YankSettings> {
  const toastDismiss = Number.parseInt(refs.urlToastDismissMs.value, 10);
  const shortcuts = collectShortcutPatch(refs, current);
  const modeCandidate = refs.jsonToolingModeSelect.value;
  const mode: JsonToolingModeSelection = modeCandidate === "mode1"
    || modeCandidate === "mode2"
    || modeCandidate === "mode3"
    ? modeCandidate
    : "off";
  const jsonToolingModePatch = buildJsonToolingModePatch(current.jsonTooling, mode);

  return {
    urlCopy: {
      ...current.urlCopy,
      showToast: refs.urlShowToast.checked,
      toastDismissMs: Number.isFinite(toastDismiss) ? Math.max(200, toastDismiss) : current.urlCopy.toastDismissMs,
    },
    autoCopy: {
      ...current.autoCopy,
      enabled: refs.autoCopyEnabled.checked,
      plainTextMode: refs.plainTextMode.checked,
      appendMode: refs.appendMode.checked,
      sourceTagMode: refs.sourceTagMode.checked,
      showSelectionCountBadge: refs.showSelectionCountBadge.checked,
      appendSeparator: refs.appendSeparator.value,
      siteRuleMode: refs.siteRuleMode.value as SiteRuleMode,
      siteRules: refs.siteRules.value
        .split(/\r?\n/)
        .map((rule) => rule.trim())
        .filter(Boolean),
    },
    jsonTooling: {
      ...jsonToolingModePatch,
      rootPathPrefix: refs.rootPathPrefix.value.trim() || "response.data",
    },
    shortcuts,
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const refs = collectFormRefs();
  let settings = await getSettings();
  fillForm(settings, refs);

  let captureTarget: ShortcutInputId | null = null;
  let captureButton: HTMLButtonElement | null = null;
  let captureOriginalLabel = "";

  function stopCapture(): void {
    if (!captureButton) {
      captureTarget = null;
      return;
    }

    captureButton.textContent = captureOriginalLabel;
    captureButton.classList.remove("active-capture");
    captureButton = null;
    captureTarget = null;
  }

  document.querySelectorAll<HTMLButtonElement>(".capture-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.shortcutId as ShortcutInputId | undefined;
      if (!targetId || !(targetId in SHORTCUT_FIELD_MAP)) return;

      if (captureButton === button) {
        stopCapture();
        showStatus("Shortcut capture canceled.");
        return;
      }

      stopCapture();
      captureTarget = targetId;
      captureButton = button;
      captureOriginalLabel = button.textContent || "Capture";
      captureButton.textContent = "Press keys...";
      captureButton.classList.add("active-capture");
      showStatus(`Capturing ${SHORTCUT_LABELS[targetId]}. Press Esc to cancel.`, "success", 0);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".clear-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.shortcutId as ShortcutInputId | undefined;
      if (!targetId || !(targetId in SHORTCUT_FIELD_MAP)) return;
      refs.shortcutInputs[targetId].value = "";
      stopCapture();
      showStatus(`Cleared: ${SHORTCUT_LABELS[targetId]}.`);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!captureTarget) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      stopCapture();
      showStatus("Shortcut capture canceled.");
      return;
    }

    const shortcut = keyboardEventToShortcutString(event);
    if (!shortcut) return;

    refs.shortcutInputs[captureTarget].value = shortcut;
    const label = SHORTCUT_LABELS[captureTarget];
    stopCapture();
    showStatus(`Captured ${label}: ${shortcut}`);
  }, true);

  for (const id of SHORTCUT_INPUT_IDS) {
    refs.shortcutInputs[id].addEventListener("blur", () => {
      const raw = refs.shortcutInputs[id].value.trim();
      if (!raw) {
        refs.shortcutInputs[id].value = "";
        return;
      }
      const normalized = normalizeShortcutString(raw);
      if (normalized) {
        refs.shortcutInputs[id].value = normalized;
      }
    });
  }

  const saveBtn = byId<HTMLButtonElement>("saveBtn");
  saveBtn.addEventListener("click", async () => {
    try {
      const patch = collectPatch(refs, settings);
      await patchSettings(patch);
      settings = await getSettings();
      fillForm(settings, refs);
      stopCapture();
      showStatus("Settings saved.", "success");
    } catch (error) {
      stopCapture();
      showStatus(error instanceof Error ? error.message : "Save failed", "error");
    }
  });

  const reloadBtn = byId<HTMLButtonElement>("reloadBtn");
  reloadBtn.addEventListener("click", async () => {
    settings = await getSettings();
    fillForm(settings, refs);
    stopCapture();
    showStatus("Reloaded.", "success");
  });
});
