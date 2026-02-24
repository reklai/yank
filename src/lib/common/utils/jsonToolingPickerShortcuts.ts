export const JSON_TOOLING_MODE_IDS = ["off", "mode1", "mode2", "mode3"] as const;

export const JSON_TOOLING_MODE_LABELS: Record<JsonToolingModeSelection, string> = {
  off: "Off",
  mode1: "Pretty Print",
  mode2: "Path Copy",
  mode3: "Markdown Table",
};

export const JSON_TOOLING_PICKER_RESERVED_KEYS = ["j", "k"] as const;

export const DEFAULT_JSON_TOOLING_PICKER_SHORTCUTS: JsonToolingPickerShortcutSettings = {
  off: "0",
  mode1: "1",
  mode2: "2",
  mode3: "3",
};

function normalizeAsciiChar(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value.length !== 1) return "";
  if (!/^[\x21-\x7e]$/.test(value)) return "";
  return value;
}

export function normalizeJsonToolingPickerKey(raw: string): string {
  return normalizeAsciiChar(raw);
}

export function validateJsonToolingPickerShortcuts(
  shortcuts: JsonToolingPickerShortcutSettings,
  reservedKeys: readonly string[] = JSON_TOOLING_PICKER_RESERVED_KEYS,
): string | null {
  const normalizedReserved = new Set(reservedKeys.map((key) => normalizeAsciiChar(key)).filter(Boolean));
  const seen = new Map<string, JsonToolingModeSelection>();

  for (const mode of JSON_TOOLING_MODE_IDS) {
    const key = normalizeAsciiChar(shortcuts[mode]);
    if (!key) {
      return `JSON Tools picker key for "${JSON_TOOLING_MODE_LABELS[mode]}" must be one visible character.`;
    }

    if (normalizedReserved.has(key)) {
      return `JSON Tools picker key "${key}" is reserved for picker navigation.`;
    }

    const firstMode = seen.get(key);
    if (firstMode) {
      return `JSON Tools picker key "${key}" is duplicated (${JSON_TOOLING_MODE_LABELS[firstMode]} + ${JSON_TOOLING_MODE_LABELS[mode]}).`;
    }

    seen.set(key, mode);
  }

  return null;
}

function nextFallbackKey(used: Set<string>): string {
  const pool = "1234567890asdfghlqwertyuiopzxcvbnm!@#$%^&*()_+-=[]{};:'\",.<>/?\\|`~";
  for (const char of pool) {
    const normalized = normalizeAsciiChar(char);
    if (!normalized || used.has(normalized)) continue;
    return normalized;
  }
  return "0";
}

export function normalizeJsonToolingPickerShortcuts(
  value: Partial<JsonToolingPickerShortcutSettings> | undefined,
): JsonToolingPickerShortcutSettings {
  const next: JsonToolingPickerShortcutSettings = {
    ...DEFAULT_JSON_TOOLING_PICKER_SHORTCUTS,
  };

  const used = new Set<string>(JSON_TOOLING_PICKER_RESERVED_KEYS);

  for (const mode of JSON_TOOLING_MODE_IDS) {
    const preferred = normalizeAsciiChar(typeof value?.[mode] === "string" ? value[mode] : "");
    const fallback = normalizeAsciiChar(DEFAULT_JSON_TOOLING_PICKER_SHORTCUTS[mode]);
    const candidate = preferred && !used.has(preferred)
      ? preferred
      : fallback && !used.has(fallback)
        ? fallback
        : nextFallbackKey(used);

    next[mode] = candidate;
    used.add(candidate);
  }

  return next;
}
