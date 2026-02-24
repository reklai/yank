export type HttpRequestSource = "curl" | "fetch" | "url";

export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpRequestShape {
  method: string;
  url: string;
  headers: HttpHeader[];
  body?: string;
  source: HttpRequestSource;
}

const CODE_FENCE_RE = /^```(?:[\w+-]+)?\n([\s\S]*?)\n```$/i;
const HTTP_METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i;

function unwrapCodeFence(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(CODE_FENCE_RE);
  return match ? match[1].trim() : trimmed;
}

function normalizeMethod(method: string | null | undefined): string {
  const value = (method || "").trim().toUpperCase();
  if (!value) return "GET";
  if (!HTTP_METHOD_RE.test(value)) return "GET";
  return value;
}

function isLikelyHttpUrl(text: string): boolean {
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseJsStringLiteral(input: string): string | null {
  const value = input.trim();
  if (value.length < 2) return null;

  const quote = value[0];
  if (quote !== "'" && quote !== "\"" && quote !== "`") return null;
  if (value[value.length - 1] !== quote) return null;
  if (quote === "`" && value.includes("${")) return null;

  let result = "";
  for (let i = 1; i < value.length - 1; i += 1) {
    const char = value[i];
    if (char !== "\\") {
      result += char;
      continue;
    }

    i += 1;
    if (i >= value.length - 1) break;
    const next = value[i];

    if (next === "n") result += "\n";
    else if (next === "r") result += "\r";
    else if (next === "t") result += "\t";
    else if (next === "b") result += "\b";
    else if (next === "f") result += "\f";
    else if (next === "v") result += "\v";
    else if (next === "0") result += "\0";
    else if (next === "x" && i + 2 < value.length - 1) {
      const hex = value.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        result += String.fromCharCode(Number.parseInt(hex, 16));
        i += 2;
      } else {
        result += next;
      }
    } else if (next === "u" && i + 4 < value.length - 1) {
      const hex = value.slice(i + 1, i + 5);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        result += String.fromCharCode(Number.parseInt(hex, 16));
        i += 4;
      } else {
        result += next;
      }
    } else {
      result += next;
    }
  }

  return result;
}

function findMatchingBracket(
  text: string,
  startIndex: number,
  openChar: "(" | "[" | "{",
  closeChar: ")" | "]" | "}",
): number {
  let depth = 0;
  let quote: "'" | "\"" | "`" | null = null;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: "'" | "\"" | "`" | null = null;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

    if (
      char === separator
      && braceDepth === 0
      && bracketDepth === 0
      && parenDepth === 0
    ) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }

  parts.push(input.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

function findTopLevelColon(input: string): number {
  let quote: "'" | "\"" | "`" | null = null;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

    if (char === ":" && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      return i;
    }
  }

  return -1;
}

function normalizeObjectKey(keySource: string): string | null {
  const raw = keySource.trim();
  if (!raw) return null;

  const fromLiteral = parseJsStringLiteral(raw);
  if (fromLiteral != null) return fromLiteral;

  const match = raw.match(/^[$A-Z_a-z][$\w]*$/);
  if (match) return match[0];

  return null;
}

function parseObjectLiteralTopLevel(source: string): Map<string, string> {
  const output = new Map<string, string>();
  const value = source.trim();
  if (!value.startsWith("{") || !value.endsWith("}")) return output;

  const body = value.slice(1, -1).trim();
  if (!body) return output;

  const entries = splitTopLevel(body, ",");
  for (const entry of entries) {
    const colonIndex = findTopLevelColon(entry);
    if (colonIndex < 0) continue;

    const keySource = entry.slice(0, colonIndex).trim();
    const valueSource = entry.slice(colonIndex + 1).trim();
    const key = normalizeObjectKey(keySource);
    if (!key) continue;
    output.set(key, valueSource);
  }

  return output;
}

function parseHeaderValue(raw: string): HttpHeader | null {
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;

  const name = raw.slice(0, separator).trim();
  const value = raw.slice(separator + 1).trim();
  if (!name) return null;
  return { name, value };
}

function parseHeadersFromObject(rawObject: string): HttpHeader[] {
  const map = parseObjectLiteralTopLevel(rawObject);
  if (map.size === 0) {
    const parsedJson = tryParseJson(rawObject);
    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      return [];
    }

    return Object.entries(parsedJson as Record<string, unknown>).map(([name, value]) => ({
      name,
      value: String(value),
    }));
  }

  const headers: HttpHeader[] = [];
  for (const [name, valueSource] of map.entries()) {
    const fromLiteral = parseJsStringLiteral(valueSource);
    headers.push({
      name,
      value: fromLiteral == null ? valueSource.trim() : fromLiteral,
    });
  }

  return headers;
}

function tokenizeShellLike(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (quote === "'") {
        if (char === "'") {
          quote = null;
        } else {
          current += char;
        }
        continue;
      }

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "'") {
      quote = "'";
      continue;
    }
    if (char === "\"") {
      quote = "\"";
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseCurlRequest(source: string): HttpRequestShape | null {
  const flat = source
    .replace(/\r\n?/g, "\n")
    .replace(/\\\n/g, " ")
    .replace(/\n+/g, " ")
    .trim();
  if (!flat) return null;

  const tokens = tokenizeShellLike(flat);
  const curlIndex = tokens.findIndex((token) => token.toLowerCase() === "curl");
  if (curlIndex < 0) return null;

  let method = "";
  let url = "";
  const headers: HttpHeader[] = [];
  const dataParts: string[] = [];
  let forceGet = false;

  let i = curlIndex + 1;
  while (i < tokens.length) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : null;

    if (token === "-X" || lower === "--request") {
      if (nextToken) {
        method = nextToken;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (token.startsWith("-X") && token.length > 2) {
      method = token.slice(2);
      i += 1;
      continue;
    }
    if (lower.startsWith("--request=")) {
      method = token.slice(token.indexOf("=") + 1);
      i += 1;
      continue;
    }

    if (token === "-I" || lower === "--head") {
      method = "HEAD";
      i += 1;
      continue;
    }

    if (token === "-G" || lower === "--get") {
      forceGet = true;
      i += 1;
      continue;
    }

    if (token === "-H" || lower === "--header") {
      if (nextToken) {
        const parsed = parseHeaderValue(nextToken);
        if (parsed) headers.push(parsed);
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (token.startsWith("-H") && token.length > 2) {
      const parsed = parseHeaderValue(token.slice(2));
      if (parsed) headers.push(parsed);
      i += 1;
      continue;
    }
    if (lower.startsWith("--header=")) {
      const parsed = parseHeaderValue(token.slice(token.indexOf("=") + 1));
      if (parsed) headers.push(parsed);
      i += 1;
      continue;
    }

    if (
      token === "-d"
      || lower === "--data"
      || lower === "--data-raw"
      || lower === "--data-binary"
      || lower === "--data-urlencode"
    ) {
      if (nextToken) {
        dataParts.push(nextToken);
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (token.startsWith("-d") && token.length > 2) {
      dataParts.push(token.slice(2));
      i += 1;
      continue;
    }
    if (
      lower.startsWith("--data=")
      || lower.startsWith("--data-raw=")
      || lower.startsWith("--data-binary=")
      || lower.startsWith("--data-urlencode=")
    ) {
      dataParts.push(token.slice(token.indexOf("=") + 1));
      i += 1;
      continue;
    }

    if (lower === "--url") {
      if (nextToken) {
        url = nextToken;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (lower.startsWith("--url=")) {
      url = token.slice(token.indexOf("=") + 1);
      i += 1;
      continue;
    }

    if (!token.startsWith("-") && !url && isLikelyHttpUrl(token)) {
      url = token;
      i += 1;
      continue;
    }

    i += 1;
  }

  if (!url) return null;

  let body: string | undefined;
  if (dataParts.length > 0) {
    body = dataParts.join("&");
  }

  if (forceGet) {
    method = "GET";
    if (body) {
      const query = body.startsWith("?") ? body.slice(1) : body;
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}${query}`;
      body = undefined;
    }
  } else if (!method) {
    method = body ? "POST" : "GET";
  }

  return {
    method: normalizeMethod(method),
    url,
    headers,
    body,
    source: "curl",
  };
}

function parseUrlArgument(source: string): string | null {
  const fromLiteral = parseJsStringLiteral(source);
  if (fromLiteral != null) return fromLiteral;

  const raw = source.trim();
  if (!raw) return null;
  if (isLikelyHttpUrl(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return null;
}

function parseMethodValue(source: string): string | null {
  const fromLiteral = parseJsStringLiteral(source);
  if (fromLiteral != null) return normalizeMethod(fromLiteral);

  const raw = source.trim().replace(/,$/, "");
  const match = raw.match(/^[A-Za-z]+$/);
  if (!match) return null;
  return normalizeMethod(match[0]);
}

function parseBodyFromFetchValue(source: string): string | undefined {
  const raw = source.trim();
  if (!raw) return undefined;

  const fromLiteral = parseJsStringLiteral(raw);
  if (fromLiteral != null) return fromLiteral;

  if (/^JSON\.stringify\s*\(/i.test(raw)) {
    const open = raw.indexOf("(");
    const close = open >= 0 ? findMatchingBracket(raw, open, "(", ")") : -1;
    if (open >= 0 && close > open) {
      const inner = raw.slice(open + 1, close).trim();
      const args = splitTopLevel(inner, ",");
      const first = (args[0] || "").trim();
      if (!first) return undefined;

      const firstLiteral = parseJsStringLiteral(first);
      if (firstLiteral != null) return firstLiteral;

      const parsed = tryParseJson(first);
      if (parsed != null) return JSON.stringify(parsed);
      return first;
    }
  }

  const parsed = tryParseJson(raw);
  if (parsed != null) return JSON.stringify(parsed);
  return raw;
}

function parseFetchRequest(source: string): HttpRequestShape | null {
  const fetchMatch = source.match(/\bfetch\s*\(/);
  if (!fetchMatch || fetchMatch.index == null) return null;

  const openParen = source.indexOf("(", fetchMatch.index);
  if (openParen < 0) return null;
  const closeParen = findMatchingBracket(source, openParen, "(", ")");
  if (closeParen < 0) return null;

  const argsSource = source.slice(openParen + 1, closeParen).trim();
  if (!argsSource) return null;

  const args = splitTopLevel(argsSource, ",");
  if (args.length === 0) return null;

  const url = parseUrlArgument(args[0]);
  if (!url) return null;

  let method = "GET";
  let headers: HttpHeader[] = [];
  let body: string | undefined;

  if (args.length >= 2) {
    const options = parseObjectLiteralTopLevel(args[1]);
    const methodValue = options.get("method");
    const headersValue = options.get("headers");
    const bodyValue = options.get("body");

    if (methodValue) {
      const parsedMethod = parseMethodValue(methodValue);
      if (parsedMethod) method = parsedMethod;
    }

    if (headersValue) {
      headers = parseHeadersFromObject(headersValue);
    }

    if (bodyValue) {
      body = parseBodyFromFetchValue(bodyValue);
      if (!methodValue && body) {
        method = "POST";
      }
    }
  }

  return {
    method: normalizeMethod(method),
    url,
    headers,
    body,
    source: "fetch",
  };
}

function parseRawUrlRequest(source: string): HttpRequestShape | null {
  const trimmed = source.trim();
  if (!trimmed) return null;

  const methodUrlMatch = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i);
  if (methodUrlMatch && isLikelyHttpUrl(methodUrlMatch[2])) {
    return {
      method: normalizeMethod(methodUrlMatch[1]),
      url: methodUrlMatch[2],
      headers: [],
      source: "url",
    };
  }

  if (isLikelyHttpUrl(trimmed)) {
    return {
      method: "GET",
      url: trimmed,
      headers: [],
      source: "url",
    };
  }

  const firstToken = trimmed.split(/\s+/, 1)[0];
  if (isLikelyHttpUrl(firstToken)) {
    return {
      method: "GET",
      url: firstToken,
      headers: [],
      source: "url",
    };
  }

  return null;
}

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}

function toShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function renderFetchBodyExpression(body: string): string {
  const parsed = tryParseJson(body);
  if (parsed != null) {
    return `JSON.stringify(${JSON.stringify(parsed)})`;
  }
  return JSON.stringify(body);
}

export function parseHttpRequestShape(input: string): HttpRequestShape | null {
  const source = unwrapCodeFence(input);
  if (!source) return null;

  return parseCurlRequest(source) || parseFetchRequest(source) || parseRawUrlRequest(source);
}

export function renderHttpRequestAsFetch(request: HttpRequestShape): string {
  const method = normalizeMethod(request.method);
  const headers = request.headers;
  const hasBody = typeof request.body === "string" && request.body.length > 0;
  const hasHeaders = headers.length > 0;
  const urlLiteral = JSON.stringify(request.url);

  if (method === "GET" && !hasHeaders && !hasBody) {
    return `await fetch(${urlLiteral});`;
  }

  const optionBlocks: string[] = [`method: ${JSON.stringify(method)}`];

  if (hasHeaders) {
    const headerRows = headers
      .map((header) => `  ${JSON.stringify(header.name)}: ${JSON.stringify(header.value)}`)
      .join(",\n");
    optionBlocks.push(`headers: {\n${headerRows}\n}`);
  }

  if (hasBody) {
    optionBlocks.push(`body: ${renderFetchBodyExpression(request.body as string)}`);
  }

  const renderedOptions = optionBlocks
    .map((block) => indentBlock(block, 2))
    .join(",\n");

  return `await fetch(${urlLiteral}, {\n${renderedOptions}\n});`;
}

export function renderHttpRequestAsCurl(request: HttpRequestShape): string {
  const method = normalizeMethod(request.method);
  const includeMethod = method !== "GET" || !!request.body;

  const firstParts: string[] = [];
  if (includeMethod) {
    firstParts.push(`-X ${method}`);
  }
  firstParts.push(toShellSingleQuoted(request.url));

  const extraParts: string[] = [];
  for (const header of request.headers) {
    extraParts.push(toShellSingleQuoted(`${header.name}: ${header.value}`));
  }

  if (request.body && request.body.length > 0) {
    extraParts.push(`--data-raw ${toShellSingleQuoted(request.body)}`);
  }

  let command = `curl ${firstParts.join(" ")}`;
  for (const part of extraParts) {
    if (part.startsWith("--data-raw")) {
      command += ` \\\n  ${part}`;
    } else {
      command += ` \\\n  -H ${part}`;
    }
  }

  return command;
}
