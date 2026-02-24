const MODIFIER_ALIASES: Record<string, "Ctrl" | "Alt" | "Shift" | "Meta"> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
  win: "Meta",
  super: "Meta",
};

const CANONICAL_SPECIAL_KEYS: Record<string, string> = {
  "`": "Backquote",
  backquote: "Backquote",
  enter: "Enter",
  return: "Enter",
  esc: "Escape",
  escape: "Escape",
  tab: "Tab",
  space: "Space",
  spacebar: "Space",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  insert: "Insert",
};

const EDITABLE_MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph"]);

function normalizeKeyToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower in CANONICAL_SPECIAL_KEYS) {
    return CANONICAL_SPECIAL_KEYS[lower];
  }

  const fnKeyMatch = lower.match(/^f(\d{1,2})$/);
  if (fnKeyMatch) {
    const num = Number.parseInt(fnKeyMatch[1], 10);
    if (Number.isFinite(num) && num >= 1 && num <= 24) {
      return `F${num}`;
    }
  }

  const digitCodeMatch = lower.match(/^digit(\d)$/);
  if (digitCodeMatch) return digitCodeMatch[1];

  const keyCodeMatch = lower.match(/^key([a-z])$/);
  if (keyCodeMatch) return keyCodeMatch[1].toUpperCase();

  if (trimmed.length === 1) {
    if (/^[a-z]$/i.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
  }

  if (/^[a-z][a-z0-9]*$/i.test(trimmed)) {
    return trimmed[0].toUpperCase() + trimmed.slice(1);
  }

  return null;
}

export function normalizeShortcutString(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  const tokens = raw
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return "";

  let keyToken: string | null = null;
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;

  for (const token of tokens) {
    const lower = token.toLowerCase();
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier) {
      if (modifier === "Ctrl") ctrl = true;
      if (modifier === "Alt") alt = true;
      if (modifier === "Shift") shift = true;
      if (modifier === "Meta") meta = true;
      continue;
    }

    const normalizedKey = normalizeKeyToken(token);
    if (!normalizedKey) return "";
    if (keyToken) return "";
    keyToken = normalizedKey;
  }

  if (!keyToken) return "";

  const output: string[] = [];
  if (ctrl) output.push("Ctrl");
  if (alt) output.push("Alt");
  if (shift) output.push("Shift");
  if (meta) output.push("Meta");
  output.push(keyToken);
  return output.join("+");
}

function eventKeyToToken(event: KeyboardEvent): string | null {
  if (event.code === "Backquote" || event.key === "`") return "Backquote";
  if (event.code === "Space" || event.key === " ") return "Space";

  const key = event.key;
  if (!key) return null;
  if (EDITABLE_MODIFIER_KEYS.has(key)) return null;

  const lower = key.toLowerCase();
  if (lower in CANONICAL_SPECIAL_KEYS) {
    return CANONICAL_SPECIAL_KEYS[lower];
  }

  if (key.length === 1) {
    if (/^[a-z]$/i.test(key)) return key.toUpperCase();
    return key;
  }

  return normalizeKeyToken(key);
}

export function keyboardEventToShortcutString(event: KeyboardEvent): string {
  const keyToken = eventKeyToToken(event);
  if (!keyToken) return "";

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(keyToken);
  return parts.join("+");
}

export function doesKeyboardEventMatchShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const normalized = normalizeShortcutString(shortcut);
  if (!normalized) return false;

  const eventShortcut = keyboardEventToShortcutString(event);
  if (!eventShortcut) return false;

  return normalized === eventShortcut;
}
