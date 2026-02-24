const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const JSON_CODE_FENCE_RE = /^```(?:json)?\n([\s\S]*?)\n```$/i;

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
