const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const JSON_CODE_FENCE_RE = /^```(?:json)?\n([\s\S]*?)\n```$/i;
const JSON_CODE_FENCE_ANY_RE = /```(?:json|javascript|js|ts|tsx|jsx)?\s*([\s\S]*?)```/gi;

export interface JsonRecoveryParseError {
  message: string;
  line: number | null;
  column: number | null;
  hint: string | null;
}

export interface JsonRecoveryParseSuccess {
  ok: true;
  value: unknown;
  strategy: string;
}

export interface JsonRecoveryParseFailure {
  ok: false;
  error: JsonRecoveryParseError;
}

export type JsonRecoveryParseResult = JsonRecoveryParseSuccess | JsonRecoveryParseFailure;

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPE[character]);
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

export function doesSiteMatchRule(url: string, rule: string): boolean {
  const trimmedRule = rule.trim();
  if (!trimmedRule) return false;

  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  const normalizedRule = trimmedRule.toLowerCase();
  if (normalizedRule.includes("*")) {
    const escapedRule = normalizedRule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const ruleRegex = new RegExp(`^${escapedRule}$`);
    return ruleRegex.test(hostname);
  }

  return hostname === normalizedRule || hostname.endsWith(`.${normalizedRule}`);
}

export function isSiteEnabled(url: string, autoCopySettings: AutoCopySettings): boolean {
  const rules = autoCopySettings.siteRules || [];
  if (rules.length === 0) return true;

  const hasMatch = rules.some((rule: string) => doesSiteMatchRule(url, rule));

  if (autoCopySettings.siteRuleMode === "whitelist") {
    return hasMatch;
  }
  return !hasMatch;
}

export function getSelectedText(): string {
  const selection = window.getSelection();
  if (!selection) return "";
  return selection.toString();
}

function computeLineAndColumn(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const prefix = source.slice(0, clamped);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1] || "").length + 1,
  };
}

function extractErrorLineColumn(message: string, source: string): { line: number | null; column: number | null } {
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColumnMatch) {
    return {
      line: Number.parseInt(lineColumnMatch[1], 10),
      column: Number.parseInt(lineColumnMatch[2], 10),
    };
  }

  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch) {
    const offset = Number.parseInt(posMatch[1], 10);
    if (Number.isFinite(offset)) {
      return computeLineAndColumn(source, offset);
    }
  }

  return { line: null, column: null };
}

function normalizeJsonParseMessage(message: string): string {
  const trimmed = message
    .replace(/^JSON\.parse:\s*/i, "")
    .replace(/\s+in JSON at position \d+$/i, "")
    .replace(/\s+at line \d+ column \d+ of the JSON data$/i, "")
    .trim();
  return trimmed || "Could not parse JSON.";
}

function inferJsonFixHint(source: string): string | null {
  if (/,\s*[}\]]/.test(source)) {
    return "Hint: remove trailing commas.";
  }
  if (/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/.test(source)) {
    return "Hint: wrap object keys in double quotes.";
  }
  if (/'[^'\\]*(?:\\.[^'\\]*)*'/.test(source)) {
    return "Hint: replace single quotes with double quotes.";
  }
  if (/\/\/|\/\*/.test(source)) {
    return "Hint: remove comments.";
  }
  if (/\b(undefined|NaN|Infinity)\b/.test(source)) {
    return "Hint: replace undefined/NaN/Infinity with valid JSON values.";
  }
  if (/\b(True|False|None)\b/.test(source)) {
    return "Hint: use true/false/null (lowercase).";
  }
  return null;
}

function extractBalancedJsonFragment(input: string): string | null {
  for (let start = 0; start < input.length; start += 1) {
    const first = input[start];
    if (first !== "{" && first !== "[") continue;

    const stack: string[] = [first === "{" ? "}" : "]"];
    let quote: '"' | "'" | null = null;

    for (let i = start + 1; i < input.length; i += 1) {
      const char = input[i];

      if (quote) {
        if (char === "\\") {
          i += 1;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }

      if (char === "{") {
        stack.push("}");
        continue;
      }
      if (char === "[") {
        stack.push("]");
        continue;
      }

      if (char === "}" || char === "]") {
        if (stack[stack.length - 1] !== char) {
          break;
        }
        stack.pop();
        if (stack.length === 0) {
          return input.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function unwrapQuotedJsonString(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < 2) return null;
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) return null;

  if (quote === '"') {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {
      return null;
    }
    return null;
  }

  return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
}

function normalizeJsLikeObject(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/\bundefined\b/g, "null")
    .replace(/\bNaN\b/g, "null")
    .replace(/\bInfinity\b/g, "null")
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner: string) => {
      const escaped = inner.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    })
    .replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function tryParseJsonCandidate(input: string): { ok: true; value: unknown } | { ok: false; error: JsonRecoveryParseError } {
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === "string") {
      const nested = parsed.trim();
      if ((nested.startsWith("{") && nested.endsWith("}")) || (nested.startsWith("[") && nested.endsWith("]"))) {
        try {
          return { ok: true, value: JSON.parse(nested) };
        } catch {
          return { ok: true, value: parsed };
        }
      }
    }
    return { ok: true, value: parsed };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const location = extractErrorLineColumn(raw, input);
    return {
      ok: false,
      error: {
        message: normalizeJsonParseMessage(raw),
        line: location.line,
        column: location.column,
        hint: inferJsonFixHint(input),
      },
    };
  }
}

function collectRecoveryCandidates(normalized: string): Array<{ strategy: string; text: string }> {
  const seen = new Set<string>();
  const candidates: Array<{ strategy: string; text: string }> = [];

  function pushCandidate(strategy: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push({ strategy, text: trimmed });
  }

  pushCandidate("raw", normalized);

  const codeFenceMatch = normalized.match(JSON_CODE_FENCE_RE);
  if (codeFenceMatch) {
    pushCandidate("code-fence", codeFenceMatch[1]);
  }

  let anyFenceMatch: RegExpExecArray | null;
  while ((anyFenceMatch = JSON_CODE_FENCE_ANY_RE.exec(normalized)) != null) {
    pushCandidate("code-fence-inline", anyFenceMatch[1]);
  }
  JSON_CODE_FENCE_ANY_RE.lastIndex = 0;

  const balanced = extractBalancedJsonFragment(normalized);
  if (balanced) {
    pushCandidate("balanced-fragment", balanced);
  }

  for (const candidate of [...candidates]) {
    const unwrapped = unwrapQuotedJsonString(candidate.text);
    if (unwrapped) {
      pushCandidate(`${candidate.strategy}-unwrapped`, unwrapped);
    }
  }

  for (const candidate of [...candidates]) {
    const normalizedJsLike = normalizeJsLikeObject(candidate.text);
    if (normalizedJsLike && normalizedJsLike !== candidate.text) {
      pushCandidate(`${candidate.strategy}-jslike`, normalizedJsLike);
    }
  }

  return candidates;
}

export function parsePotentialJson(input: string): unknown | null {
  const normalized = input.trim();
  if (!normalized) return null;

  const codeFenceMatch = normalized.match(JSON_CODE_FENCE_RE);
  const jsonSource = codeFenceMatch ? codeFenceMatch[1] : normalized;

  try {
    return JSON.parse(jsonSource);
  } catch {
    return null;
  }
}

export function parsePotentialJsonWithRecovery(input: string): JsonRecoveryParseResult {
  const normalized = input.trim();
  if (!normalized) {
    return {
      ok: false,
      error: {
        message: "Input is empty.",
        line: null,
        column: null,
        hint: "Hint: select JSON text, place cursor near a JSON code block, or copy JSON first.",
      },
    };
  }

  const candidates = collectRecoveryCandidates(normalized);
  let firstError: JsonRecoveryParseError | null = null;

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate.text);
    if (parsed.ok) {
      return {
        ok: true,
        value: parsed.value,
        strategy: candidate.strategy,
      };
    }

    if (!firstError) {
      firstError = parsed.error;
    }
  }

  return {
    ok: false,
    error: firstError || {
      message: "Could not parse JSON.",
      line: null,
      column: null,
      hint: inferJsonFixHint(normalized),
    },
  };
}

export function prettyPrintJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function isArrayOfObjects(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  return value.every((entry) => !!entry && typeof entry === "object" && !Array.isArray(entry));
}

function stringifyTableCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value).replace(/\|/g, "\\|");
}

export function jsonArrayToMarkdownTable(rows: Array<Record<string, unknown>>): string {
  const columns = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>()),
  );

  if (columns.length === 0) return "| value |\n|---|\n| |";

  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const lines = rows.map((row) => {
    const cells = columns.map((column) => stringifyTableCell(row[column]));
    return `| ${cells.join(" | ")} |`;
  });

  return [header, separator, ...lines].join("\n");
}

export function shorten(text: string, max = 64): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
