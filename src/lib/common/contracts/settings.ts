import { normalizeShortcutString } from "../utils/shortcuts";
import { normalizeJsonToolingPickerShortcuts } from "../utils/jsonToolingPickerShortcuts";

export const DEFAULT_SETTINGS: YankSettings = {
  urlCopy: {
    showToast: true,
    toastDismissMs: 1800,
  },
  autoCopy: {
    enabled: false,
    plainTextMode: true,
    appendMode: false,
    sourceTagMode: false,
    siteRuleMode: "blacklist",
    siteRules: [],
    appendSeparator: "\n",
    showSelectionCountBadge: true,
  },
  jsonTooling: {
    prettyPrintEnabled: false,
    tableFromArrayEnabled: false,
    decorateJsonBlocks: false,
    rootPathPrefix: "response.data",
    pickerShortcuts: normalizeJsonToolingPickerShortcuts(undefined),
  },
  shortcuts: {
    switchToAutoCopy: "Alt+T",
    switchToJsonTooling: "Alt+D",
    copyPageUrl: "Alt+C",
    copyCleanCodeBlock: "Alt+Shift+C",
    copyAsFetch: "Alt+F",
    copyAsCurl: "Alt+Shift+F",
  },
};

function cloneSettings(settings: YankSettings): YankSettings {
  return JSON.parse(JSON.stringify(settings)) as YankSettings;
}

interface DeepPartialSettings {
  urlCopy?: Partial<UrlCopySettings>;
  autoCopy?: Partial<AutoCopySettings>;
  jsonTooling?: Partial<JsonToolingSettings>;
  shortcuts?: Partial<ShortcutSettings>;
}

function normalizeJsonToolingSettings(settings: JsonToolingSettings): JsonToolingSettings {
  const mode = settings.prettyPrintEnabled
    ? "mode1"
    : settings.decorateJsonBlocks
      ? "mode2"
      : settings.tableFromArrayEnabled
        ? "mode3"
        : "off";

  return {
    ...settings,
    prettyPrintEnabled: mode === "mode1",
    decorateJsonBlocks: mode === "mode2",
    tableFromArrayEnabled: mode === "mode3",
    pickerShortcuts: normalizeJsonToolingPickerShortcuts(settings.pickerShortcuts),
  };
}

export function mergeSettings(stored: DeepPartialSettings | null | undefined): YankSettings {
  const merged = cloneSettings(DEFAULT_SETTINGS);
  if (!stored || typeof stored !== "object") {
    return merged;
  }

  if (stored.urlCopy) {
    merged.urlCopy = {
      ...merged.urlCopy,
      ...stored.urlCopy,
    };
  }

  if (stored.autoCopy) {
    const next = {
      ...merged.autoCopy,
      ...stored.autoCopy,
    };
    next.siteRules = Array.isArray(next.siteRules)
      ? next.siteRules.filter((value: unknown): value is string => typeof value === "string")
      : [];
    merged.autoCopy = next;
  }

  if (stored.jsonTooling) {
    merged.jsonTooling = normalizeJsonToolingSettings({
      ...merged.jsonTooling,
      ...stored.jsonTooling,
    });
  }

  if (stored.shortcuts && typeof stored.shortcuts === "object") {
    const incoming = {
      ...merged.shortcuts,
      ...stored.shortcuts,
    };
    const keys = Object.keys(merged.shortcuts) as Array<keyof ShortcutSettings>;

    for (const key of keys) {
      const raw = incoming[key];
      if (typeof raw !== "string") {
        incoming[key] = merged.shortcuts[key];
        continue;
      }

      const trimmed = raw.trim();
      if (!trimmed) {
        incoming[key] = "";
        continue;
      }

      const normalized = normalizeShortcutString(trimmed);
      incoming[key] = normalized || merged.shortcuts[key];
    }

    merged.shortcuts = incoming;
  }

  return merged;
}
