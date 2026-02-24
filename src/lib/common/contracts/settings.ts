import { normalizeShortcutString } from "../utils/shortcuts";

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
  },
  shortcuts: {
    switchToAutoCopy: "Alt+Y",
    jsonToolingPrettyPrint: "Alt+P",
    jsonToolingPathCopy: "Alt+O",
    jsonToolingMarkdownTable: "Alt+I",
    copyPageUrl: "Alt+U",
    copyCleanCodeBlock: "Alt+K",
    copyAsFetch: "Alt+J",
    copyAsCurl: "Alt+H",
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
  const rootPathPrefix = typeof settings.rootPathPrefix === "string" && settings.rootPathPrefix.trim()
    ? settings.rootPathPrefix
    : DEFAULT_SETTINGS.jsonTooling.rootPathPrefix;

  return {
    prettyPrintEnabled: mode === "mode1",
    decorateJsonBlocks: mode === "mode2",
    tableFromArrayEnabled: mode === "mode3",
    rootPathPrefix,
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
    } as Partial<ShortcutSettings>;
    const keys = Object.keys(merged.shortcuts) as Array<keyof ShortcutSettings>;
    const normalizedShortcuts: ShortcutSettings = { ...merged.shortcuts };

    for (const key of keys) {
      const raw = incoming[key];
      if (typeof raw !== "string") {
        normalizedShortcuts[key] = merged.shortcuts[key];
        continue;
      }

      const trimmed = raw.trim();
      if (!trimmed) {
        normalizedShortcuts[key] = "";
        continue;
      }

      const normalized = normalizeShortcutString(trimmed);
      normalizedShortcuts[key] = normalized || merged.shortcuts[key];
    }

    merged.shortcuts = normalizedShortcuts;
  }

  return merged;
}
