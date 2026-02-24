import browser from "webextension-polyfill";
import {
  getSettings,
  notifyContentReady,
  patchSettings,
} from "../adapters/runtime/yankApi";
import { mergeSettings } from "../common/contracts/settings";
import { ContentRuntimeMessage } from "../common/contracts/runtimeMessages";
import { appendClipboardText, readClipboardText, writeClipboardText } from "../common/utils/clipboard";
import {
  escapeHtml,
  getSelectedText,
  isArrayOfObjects,
  isSiteEnabled,
  jsonArrayToMarkdownTable,
  normalizeWhitespace,
  parsePotentialJson,
  prettyPrintJson,
  shorten,
} from "../common/utils/helpers";
import {
  parseHttpRequestShape,
  renderHttpRequestAsCurl,
  renderHttpRequestAsFetch,
} from "../common/utils/httpTransforms";
import { doesKeyboardEventMatchShortcut, keyboardEventToShortcutString } from "../common/utils/shortcuts";
import { showToast } from "../common/utils/toast";
import { createHelpMenu } from "../ui/helpMenu/helpMenu";
import { createModePill } from "../ui/modePill/modePill";

const CODE_BLOCK_SELECTOR = [
  "pre",
  "code",
  ".monaco-editor",
  ".CodeMirror",
  ".cm-editor",
  ".highlight",
  ".hljs",
  "[class*='language-']",
].join(",");

const CODE_COPY_NEAR_THRESHOLD_PX = 140;
const HELP_MENU_SHORTCUT = "Alt+M";
const INSTANCE_LOCK_ATTR = "data-yank-instance-active";
const SHORTCUT_DEDUP_LOCK_ATTR = "data-yank-shortcut-lock";
const SHORTCUT_DEDUP_MS = 220;

interface CodeCopyCandidate {
  text: string;
  rects: DOMRect[];
}

type HttpTransformTarget = "fetch" | "curl";

interface HttpTransformCandidate {
  text: string;
  rects: DOMRect[];
  source: "selection" | "code-block" | "clipboard";
}

function isEditableElement(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  if (node.tagName === "TEXTAREA") return true;
  if (node.tagName !== "INPUT") return false;

  const input = node as HTMLInputElement;
  const editableTypes = new Set([
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
  ]);
  return editableTypes.has(input.type);
}

function getSelectionRangeRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

function renderSelectionCountBadge(charCount: number): void {
  const rect = getSelectionRangeRect();
  if (!rect) return;

  const badge = document.createElement("div");
  badge.textContent = `${charCount} chars`;
  badge.style.cssText = [
    "position:fixed",
    `left:${Math.max(8, rect.left)}px`,
    `top:${Math.max(8, rect.top - 28)}px`,
    "z-index:2147483647",
    "padding:2px 6px",
    "border-radius:6px",
    "border:1px solid rgba(10,132,255,0.35)",
    "background:rgba(20,30,45,0.96)",
    "color:#9ecbff",
    "font:11px/1.2 'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
    "box-shadow:0 8px 18px rgba(0,0,0,0.34)",
    "pointer-events:none",
    "opacity:0",
    "transform:translateY(6px)",
    "transition:opacity 0.14s ease, transform 0.14s ease",
  ].join(";");

  document.documentElement.appendChild(badge);
  requestAnimationFrame(() => {
    badge.style.opacity = "1";
    badge.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    badge.style.opacity = "0";
    badge.style.transform = "translateY(6px)";
    window.setTimeout(() => badge.remove(), 140);
  }, 650);
}

function jsonPrimitiveToHtml(value: unknown): string {
  if (typeof value === "string") {
    return `<span class="yank-json-string">"${escapeHtml(value)}"</span>`;
  }
  if (typeof value === "number") {
    return `<span class="yank-json-number">${String(value)}</span>`;
  }
  if (typeof value === "boolean") {
    return `<span class="yank-json-boolean">${String(value)}</span>`;
  }
  if (value === null) {
    return `<span class="yank-json-null">null</span>`;
  }
  return `<span class="yank-json-unknown">${escapeHtml(String(value))}</span>`;
}

function renderJsonWithPaths(value: unknown, pathPrefix: string, depth = 0): string {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const lines = ["["];
    value.forEach((entry, index) => {
      const path = `${pathPrefix}[${index}]`;
      const rendered = renderJsonWithPaths(entry, path, depth + 1);
      const comma = index === value.length - 1 ? "" : ",";
      lines.push(`${indent}  ${rendered}${comma}`);
    });
    lines.push(`${indent}]`);
    return lines.join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";

    const lines = ["{"];
    entries.forEach(([key, entry], index) => {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key;
      const rendered = renderJsonWithPaths(entry, path, depth + 1);
      const comma = index === entries.length - 1 ? "" : ",";
      const safePath = escapeHtml(path);
      const safeKey = escapeHtml(key);
      lines.push(
        `${indent}  <span class="yank-json-key" data-yank-path="${safePath}" title="${safePath}">"${safeKey}"</span>: ${rendered}${comma}`,
      );
    });
    lines.push(`${indent}}`);
    return lines.join("\n");
  }

  return jsonPrimitiveToHtml(value);
}

function ensureJsonDecorationStyle(): void {
  if (document.getElementById("yank-json-decoration-style")) return;

  const style = document.createElement("style");
  style.id = "yank-json-decoration-style";
  style.textContent = `
    .yank-json-host {
      white-space: pre !important;
      overflow: auto !important;
      font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace !important;
      line-height: 1.5 !important;
      tab-size: 2 !important;
    }
    .yank-json-key {
      color: #9bc6ff !important;
      cursor: pointer !important;
      text-decoration: underline dotted rgba(155, 198, 255, 0.4);
    }
    .yank-json-key:hover {
      color: #d3e7ff !important;
      background: rgba(10, 132, 255, 0.16) !important;
      border-radius: 3px;
    }
    .yank-json-string { color: #f5bc6f !important; }
    .yank-json-number { color: #d6a4ff !important; }
    .yank-json-boolean { color: #ff8c8c !important; }
    .yank-json-null { color: #8bb8d6 !important; }
    .yank-json-unknown { color: #b0b0b0 !important; }
  `;
  document.documentElement.appendChild(style);
}

function nodeToElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (node instanceof HTMLElement) return node;
  if (node.parentElement) return node.parentElement;
  return null;
}

function isLikelyCodeBlockElement(element: HTMLElement): boolean {
  const tag = element.tagName;
  if (tag === "PRE") return true;
  if (tag === "CODE") {
    return element.parentElement?.tagName === "PRE" || getComputedStyle(element).display.includes("block");
  }

  const classText = `${element.className || ""}`.toLowerCase();
  return (
    classText.includes("code")
    || classText.includes("monaco")
    || classText.includes("codemirror")
    || classText.includes("hljs")
    || classText.includes("highlight")
    || classText.includes("language-")
  );
}

function closestCodeContainerFromNode(node: Node | null): HTMLElement | null {
  const element = nodeToElement(node);
  if (!element) return null;

  const closest = element.closest(CODE_BLOCK_SELECTOR) as HTMLElement | null;
  if (!closest || !isLikelyCodeBlockElement(closest)) return null;

  if (closest.tagName === "CODE" && closest.parentElement?.tagName === "PRE") {
    return closest.parentElement;
  }

  return closest;
}

function getElementRects(element: HTMLElement): DOMRect[] {
  const rects = Array.from(element.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length > 0) return rects;
  const box = element.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) return [box];
  return [];
}

function getRangeRects(range: Range): DOMRect[] {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length > 0) return rects;
  const box = range.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) return [box];
  return [];
}

function elementTextForCopy(element: HTMLElement): string {
  const textFromInnerText = element.innerText || "";
  if (textFromInnerText.trim().length > 0) return textFromInnerText;
  return element.textContent || "";
}

function stripLeadingLineNumbers(lines: string[]): string[] {
  const candidates = lines.filter((line) => line.trim().length > 0);
  if (candidates.length < 2) return lines;

  const numberedCount = candidates.filter((line) => /^\s*\d+\s{1,3}\S/.test(line)).length;
  if (numberedCount / candidates.length < 0.6) return lines;

  return lines.map((line) => line.replace(/^(\s*)\d+\s{1,3}(?=\S)/, "$1"));
}

function stripPromptPrefixes(lines: string[]): string[] {
  const candidates = lines.filter((line) => line.trim().length > 0);
  if (candidates.length === 0) return lines;

  const promptSpecs = [
    { prefix: "$", regex: /^\s*\$\s/ },
    { prefix: ">>>", regex: /^\s*>>>\s/ },
    { prefix: "...", regex: /^\s*\.\.\.\s/ },
  ];

  for (const spec of promptSpecs) {
    const count = candidates.filter((line) => spec.regex.test(line)).length;
    if (count < Math.max(1, Math.ceil(candidates.length * 0.55))) continue;
    return lines.map((line) => line.replace(spec.regex, ""));
  }

  return lines;
}

function cleanCopiedCode(rawText: string): string {
  let text = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "");

  let lines = text.split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  lines = stripLeadingLineNumbers(lines);
  lines = stripPromptPrefixes(lines);
  lines = lines.map((line) => line.replace(/[ \t]+$/g, ""));

  text = lines.join("\n");
  return text.trim().length > 0 ? text : rawText.trim();
}

function distancePointToRect(x: number, y: number, rect: DOMRect): number {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
}

function flashCodeCopyOverlay(rects: DOMRect[]): void {
  const visibleRects = rects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .slice(0, 120);

  if (visibleRects.length === 0) return;

  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "pointer-events:none",
  ].join(";");

  const highlightNodes: HTMLDivElement[] = [];
  for (const rect of visibleRects) {
    const marker = document.createElement("div");
    marker.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "background:rgba(254,188,46,0.12)",
      "border:1px solid rgba(254,188,46,0.78)",
      "box-shadow:0 0 0 1px rgba(254,188,46,0.3), 0 0 10px rgba(254,188,46,0.25)",
      "border-radius:6px",
      "opacity:0",
      "transition:opacity 0.18s ease",
    ].join(";");
    host.appendChild(marker);
    highlightNodes.push(marker);
  }

  document.documentElement.appendChild(host);
  requestAnimationFrame(() => {
    for (const marker of highlightNodes) {
      marker.style.opacity = "1";
    }
  });

  window.setTimeout(() => {
    for (const marker of highlightNodes) {
      marker.style.opacity = "0";
    }
    window.setTimeout(() => host.remove(), 230);
  }, 240);
}

function shouldSuppressDuplicateShortcut(event: KeyboardEvent): boolean {
  if (event.repeat) return true;

  const shortcut = keyboardEventToShortcutString(event);
  if (!shortcut) return false;

  const host = document.documentElement;
  const raw = host.getAttribute(SHORTCUT_DEDUP_LOCK_ATTR) || "";
  const separatorIndex = raw.lastIndexOf("::");
  if (separatorIndex > 0) {
    const lastShortcut = raw.slice(0, separatorIndex);
    const lastTs = Number.parseInt(raw.slice(separatorIndex + 2), 10);
    if (lastShortcut === shortcut && Number.isFinite(lastTs) && Date.now() - lastTs < SHORTCUT_DEDUP_MS) {
      return true;
    }
  }

  host.setAttribute(SHORTCUT_DEDUP_LOCK_ATTR, `${shortcut}::${Date.now()}`);
  return false;
}

export function initApp(): void {
  const root = document.documentElement;
  if (root.hasAttribute(INSTANCE_LOCK_ATTR)) {
    return;
  }
  root.setAttribute(INSTANCE_LOCK_ATTR, "1");

  if (window.__yankCleanup) {
    window.__yankCleanup();
  }

  let settingsState: YankSettings = mergeSettings(undefined);
  let modePill = createModePill("");
  const helpMenu = createHelpMenu();

  let lastAutoCopiedSelection = "";
  let autoCopyTimer: number | null = null;
  let jsonDecorationTimer: number | null = null;
  let hoveredCodeElement: HTMLElement | null = null;
  let pointerClientX: number | null = null;
  let pointerClientY: number | null = null;
  let lastJsonToolingWarningMessage = "";
  let lastJsonToolingWarningTs = 0;

  function currentSettings(): YankSettings {
    return settingsState;
  }

  function resolveJsonToolingMode(settings: JsonToolingSettings): JsonToolingModeSelection {
    if (settings.prettyPrintEnabled) return "mode1";
    if (settings.decorateJsonBlocks) return "mode2";
    if (settings.tableFromArrayEnabled) return "mode3";
    return "off";
  }

  function jsonToolingModeLabel(mode: JsonToolingModeSelection): "Off" | "Pretty Print" | "Path Copy" | "Markdown Table" {
    if (mode === "mode1") return "Pretty Print";
    if (mode === "mode2") return "Path Copy";
    if (mode === "mode3") return "Markdown Table";
    return "Off";
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

  function buildHelpMenuData(settings: YankSettings): {
    shortcuts: ShortcutSettings;
    autoCopyEnabled: boolean;
    jsonModeLabel: "Off" | "Pretty Print" | "Path Copy" | "Markdown Table";
  } {
    return {
      shortcuts: settings.shortcuts,
      autoCopyEnabled: settings.autoCopy.enabled,
      jsonModeLabel: jsonToolingModeLabel(resolveJsonToolingMode(settings.jsonTooling)),
    };
  }

  function closeTransientPanels(): void {
    helpMenu.hide();
  }

  function showJsonToolingWarning(message: string): void {
    const now = Date.now();
    if (lastJsonToolingWarningMessage === message && now - lastJsonToolingWarningTs < 900) return;
    lastJsonToolingWarningMessage = message;
    lastJsonToolingWarningTs = now;
    showToast(message, { kind: "warning", dismissMs: 1700 });
  }

  function isJsonToolingTransformEnabled(settings: YankSettings): boolean {
    return settings.jsonTooling.prettyPrintEnabled || settings.jsonTooling.tableFromArrayEnabled;
  }

  function resolveJsonToolingActiveLabel(settings: YankSettings): string | null {
    if (settings.jsonTooling.prettyPrintEnabled) return "JSON Tools: Pretty Print";
    if (settings.jsonTooling.decorateJsonBlocks) return "JSON Tools: Path Copy";
    if (settings.jsonTooling.tableFromArrayEnabled) return "JSON Tools: Markdown Table";
    return null;
  }

  function hasActivePillState(settings: YankSettings): boolean {
    return settings.autoCopy.enabled || resolveJsonToolingActiveLabel(settings) != null;
  }

  function syncModePill(): void {
    const settings = currentSettings();
    const labels: string[] = [];

    if (settings.autoCopy.enabled) {
      labels.push("Auto-Copy");
    }

    const jsonToolingLabel = resolveJsonToolingActiveLabel(settings);
    if (jsonToolingLabel) {
      labels.push(jsonToolingLabel);
    }

    if (labels.length === 0) {
      modePill.setVisible(false);
      return;
    }

    modePill.setVisible(true);
    modePill.setText(labels.join(" • "));
  }

  async function refreshState(): Promise<void> {
    settingsState = await getSettings();
    syncModePill();
  }

  async function runPageCopy(): Promise<void> {
    const settings = currentSettings();

    const copied = await writeClipboardText(location.href);

    if (settings.urlCopy.showToast) {
      showToast(copied ? "Copied current page URL" : "Clipboard write failed", {
        kind: copied ? "success" : "error",
        dismissMs: settings.urlCopy.toastDismissMs,
      });
    }
  }

  function buildCandidateFromElement(element: HTMLElement): CodeCopyCandidate | null {
    const rawText = elementTextForCopy(element);
    const cleaned = cleanCopiedCode(rawText);
    if (!cleaned.trim()) return null;

    const rects = getElementRects(element);
    if (rects.length === 0) return null;

    return { text: cleaned, rects };
  }

  function detectCodeCopyCandidate(): CodeCopyCandidate | null {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const startCode = closestCodeContainerFromNode(range.startContainer);
      const endCode = closestCodeContainerFromNode(range.endContainer);
      if (startCode && endCode && startCode === endCode) {
        const cleanedSelection = cleanCopiedCode(range.toString());
        if (cleanedSelection.trim()) {
          const rects = getRangeRects(range);
          if (rects.length > 0) {
            return { text: cleanedSelection, rects };
          }
        }
      }
    }

    const caretCode = selection && selection.rangeCount > 0
      ? closestCodeContainerFromNode(selection.anchorNode)
      : null;
    if (caretCode) {
      const candidate = buildCandidateFromElement(caretCode);
      if (candidate) return candidate;
    }

    const focusedCode = closestCodeContainerFromNode(document.activeElement);
    if (focusedCode) {
      const candidate = buildCandidateFromElement(focusedCode);
      if (candidate) return candidate;
    }

    if (hoveredCodeElement && document.contains(hoveredCodeElement)) {
      const candidate = buildCandidateFromElement(hoveredCodeElement);
      if (candidate) return candidate;
    }

    if (pointerClientX == null || pointerClientY == null) return null;

    const blocks = Array.from(document.querySelectorAll<HTMLElement>(CODE_BLOCK_SELECTOR))
      .filter((element) => isLikelyCodeBlockElement(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
        return elementTextForCopy(element).trim().length >= 8;
      });

    let bestElement: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      const distance = distancePointToRect(pointerClientX, pointerClientY, rect);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestElement = block;
      }
    }

    if (!bestElement || bestDistance > CODE_COPY_NEAR_THRESHOLD_PX) return null;
    return buildCandidateFromElement(bestElement);
  }

  function detectHttpTransformCandidate(): HttpTransformCandidate | null {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const cleanedSelection = cleanCopiedCode(range.toString());
      if (cleanedSelection.trim()) {
        return {
          text: cleanedSelection,
          rects: getRangeRects(range),
          source: "selection",
        };
      }
    }

    const codeCandidate = detectCodeCopyCandidate();
    if (codeCandidate) {
      return {
        text: codeCandidate.text,
        rects: codeCandidate.rects,
        source: "code-block",
      };
    }

    return null;
  }

  async function runCleanCodeBlockCopy(): Promise<void> {
    const candidate = detectCodeCopyCandidate();
    if (!candidate) {
      showToast("No code block found near selection/cursor.", { kind: "warning" });
      return;
    }

    const copied = await writeClipboardText(candidate.text);
    if (copied) {
      flashCodeCopyOverlay(candidate.rects);
    }

    const lineCount = Math.max(1, candidate.text.split("\n").length);
    const plural = lineCount === 1 ? "line" : "lines";
    showToast(copied ? `Copied clean code (${lineCount} ${plural})` : "Clipboard write failed", {
      kind: copied ? "success" : "error",
    });
  }

  async function runHttpTransformCopy(target: HttpTransformTarget): Promise<void> {
    const inlineCandidate = detectHttpTransformCandidate();
    let candidate = inlineCandidate;

    if (!candidate) {
      const clipboardSource = cleanCopiedCode(await readClipboardText());
      if (clipboardSource.trim()) {
        candidate = {
          text: clipboardSource,
          rects: [],
          source: "clipboard",
        };
      }
    }

    if (!candidate) {
      showToast("No request text found in selection/code/clipboard.", { kind: "warning" });
      return;
    }

    const requestShape = parseHttpRequestShape(candidate.text);
    if (!requestShape) {
      showToast("Could not parse an HTTP request.", { kind: "warning" });
      return;
    }

    const output = target === "fetch"
      ? renderHttpRequestAsFetch(requestShape)
      : renderHttpRequestAsCurl(requestShape);

    const copied = await writeClipboardText(output);
    if (copied && candidate.source !== "clipboard" && candidate.rects.length > 0) {
      flashCodeCopyOverlay(candidate.rects);
    }

    const targetLabel = target === "fetch" ? "Fetch" : "cURL";
    const requestSummary = shorten(`${requestShape.method} ${requestShape.url}`, 78);
    showToast(copied ? `Copied as ${targetLabel} (${requestSummary})` : "Clipboard write failed", {
      kind: copied ? "success" : "error",
    });
  }

  async function runAutoCopyFromSelection(): Promise<void> {
    const settings = currentSettings();
    if (!settings.autoCopy.enabled) return;
    if (!isSiteEnabled(location.href, settings.autoCopy)) return;

    const rawSelection = getSelectedText();
    const selected = settings.autoCopy.plainTextMode
      ? normalizeWhitespace(rawSelection)
      : rawSelection.replace(/\r\n?/g, "\n").trim();
    if (!selected) return;

    const signature = `${selected}:::${location.href}`;
    if (signature === lastAutoCopiedSelection) return;

    if (settings.autoCopy.showSelectionCountBadge) {
      renderSelectionCountBadge(selected.length);
    }

    const withSourceTag = settings.autoCopy.sourceTagMode
      ? `${selected}\n\n- ${location.href}`
      : selected;

    if (settings.autoCopy.appendMode) {
      await appendClipboardText(withSourceTag, settings.autoCopy.appendSeparator);
    } else {
      await writeClipboardText(withSourceTag);
    }

    lastAutoCopiedSelection = signature;
    showToast(`Auto-copied ${withSourceTag.length} chars`, { dismissMs: 1200 });
  }

  function scheduleAutoCopy(): void {
    if (autoCopyTimer != null) {
      window.clearTimeout(autoCopyTimer);
    }
    autoCopyTimer = window.setTimeout(() => {
      void runAutoCopyFromSelection();
    }, 120);
  }

  function transformJsonForJsonTooling(value: unknown): string | null {
    const settings = currentSettings();

    if (settings.jsonTooling.tableFromArrayEnabled) {
      if (isArrayOfObjects(value)) {
        return jsonArrayToMarkdownTable(value);
      }
      return null;
    }

    if (settings.jsonTooling.prettyPrintEnabled) {
      return prettyPrintJson(value);
    }

    return null;
  }

  function maybeTransformCopyEvent(event: ClipboardEvent): void {
    const settings = currentSettings();
    if (!isJsonToolingTransformEnabled(settings)) return;

    const selected = getSelectedText().trim();
    if (!selected) {
      if (settings.jsonTooling.prettyPrintEnabled) {
        showJsonToolingWarning("JSON Tools Pretty Print: no selected text to transform.");
      } else if (settings.jsonTooling.tableFromArrayEnabled) {
        showJsonToolingWarning("JSON Tools Markdown Table: no selected text to transform.");
      } else {
        showJsonToolingWarning("JSON Tools: no selected text to transform.");
      }
      return;
    }

    const parsed = parsePotentialJson(selected);
    if (parsed == null) {
      if (settings.jsonTooling.prettyPrintEnabled) {
        showJsonToolingWarning("JSON Tools Pretty Print: copied text is not valid JSON.");
      } else if (settings.jsonTooling.tableFromArrayEnabled) {
        showJsonToolingWarning("JSON Tools Markdown Table: copied text is not valid JSON.");
      } else {
        showJsonToolingWarning("JSON Tools: copied text is not valid JSON.");
      }
      return;
    }

    const transformed = transformJsonForJsonTooling(parsed);
    if (transformed == null) {
      if (settings.jsonTooling.tableFromArrayEnabled) {
        showJsonToolingWarning("JSON Tools Markdown Table requires a JSON array of objects.");
      } else {
        showJsonToolingWarning("JSON Tools Pretty Print could not transform copied JSON.");
      }
      return;
    }

    if (!event.clipboardData) {
      void writeClipboardText(transformed).then((ok) => {
        showToast(ok ? "JSON Tools transformed copied JSON" : "JSON Tools could not write transformed JSON.", {
          kind: ok ? "success" : "error",
        });
      });
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", transformed);
    showToast("JSON Tools transformed copied JSON");
  }

  function decorateJsonBlocksForPathCopy(): number {
    if (!currentSettings().jsonTooling.decorateJsonBlocks) return 0;

    ensureJsonDecorationStyle();
    let decoratedCount = 0;

    const blocks = document.querySelectorAll<HTMLElement>("pre, code");
    blocks.forEach((block) => {
      if (block.dataset.yankJsonDecorated === "1") return;
      if (block.tagName === "CODE" && block.parentElement?.tagName === "PRE") return;

      const source = block.textContent?.trim() || "";
      if (source.length < 2 || source.length > 40000) return;

      const parsed = parsePotentialJson(source);
      if (parsed == null) return;

      const rootPath = currentSettings().jsonTooling.rootPathPrefix || "response.data";
      const rendered = renderJsonWithPaths(parsed, rootPath, 0);
      block.dataset.yankJsonDecorated = "1";
      block.classList.add("yank-json-host");
      block.innerHTML = rendered;
      decoratedCount += 1;
    });

    return decoratedCount;
  }

  function scheduleJsonBlockDecoration(notifyWhenNone = false): void {
    if (jsonDecorationTimer != null) {
      window.clearTimeout(jsonDecorationTimer);
    }
    jsonDecorationTimer = window.setTimeout(() => {
      if (!currentSettings().jsonTooling.decorateJsonBlocks) return;
      const decoratedCount = decorateJsonBlocksForPathCopy();
      if (notifyWhenNone && decoratedCount === 0) {
        showJsonToolingWarning("JSON Tools Path Copy: no JSON code blocks found on this page.");
      }
    }, 120);
  }

  async function toggleAutoCopyByShortcut(): Promise<void> {
    const settings = currentSettings();
    const nextEnabled = !settings.autoCopy.enabled;
    const nextAutoCopy: AutoCopySettings = {
      ...settings.autoCopy,
      enabled: nextEnabled,
    };

    await patchSettings({
      autoCopy: nextAutoCopy,
    });
    await refreshState();
    syncModePill();
    if (hasActivePillState(currentSettings())) {
      modePill.flash();
    }

    showToast(nextEnabled ? "Auto-Copy enabled" : "Auto-Copy disabled", {
      kind: "success",
    });
  }

  async function switchJsonToolingModeByShortcut(targetMode: Exclude<JsonToolingModeSelection, "off">): Promise<void> {
    const settings = currentSettings();
    const currentMode = resolveJsonToolingMode(settings.jsonTooling);
    const nextMode: JsonToolingModeSelection = currentMode === targetMode ? "off" : targetMode;

    const nextJsonTooling = buildJsonToolingModePatch(settings.jsonTooling, nextMode);
    await patchSettings({
      jsonTooling: nextJsonTooling,
    });
    await refreshState();
    syncModePill();
    if (hasActivePillState(currentSettings())) {
      modePill.flash();
    }

    if (nextMode === "mode2") {
      scheduleJsonBlockDecoration(true);
    }

    showToast(
      nextMode === "off"
        ? "JSON Tools disabled"
        : `JSON Tools mode: ${jsonToolingModeLabel(nextMode)}`,
      { kind: "success" },
    );
  }

  async function handleRuntimeMessage(message: unknown): Promise<unknown> {
    const runtimeMessage = message as ContentRuntimeMessage;

    if (runtimeMessage.type === "SHOW_TOAST") {
      showToast(runtimeMessage.toast.message, {
        kind: runtimeMessage.toast.kind || "success",
      });
      return { ok: true };
    }

    if (runtimeMessage.type === "RUN_COPY_PAGE_URL") {
      await runPageCopy();
      return { ok: true };
    }

    return undefined;
  }

  async function keydownHandler(event: KeyboardEvent): Promise<void> {
    if (shouldSuppressDuplicateShortcut(event)) {
      return;
    }

    if (event.key === "Escape" && helpMenu.isVisible()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      helpMenu.hide();
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, HELP_MENU_SHORTCUT)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      helpMenu.toggle(buildHelpMenuData(currentSettings()));
      return;
    }

    if (helpMenu.isVisible()) {
      return;
    }

    const shortcuts = currentSettings().shortcuts;

    if (doesKeyboardEventMatchShortcut(event, shortcuts.switchToAutoCopy)) {
      event.preventDefault();
      event.stopPropagation();
      await toggleAutoCopyByShortcut();
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.jsonToolingPrettyPrint)) {
      event.preventDefault();
      event.stopPropagation();
      await switchJsonToolingModeByShortcut("mode1");
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.jsonToolingPathCopy)) {
      event.preventDefault();
      event.stopPropagation();
      await switchJsonToolingModeByShortcut("mode2");
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.jsonToolingMarkdownTable)) {
      event.preventDefault();
      event.stopPropagation();
      await switchJsonToolingModeByShortcut("mode3");
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.copyCleanCodeBlock)) {
      event.preventDefault();
      event.stopPropagation();
      await runCleanCodeBlockCopy();
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.copyAsFetch)) {
      event.preventDefault();
      event.stopPropagation();
      await runHttpTransformCopy("fetch");
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.copyAsCurl)) {
      event.preventDefault();
      event.stopPropagation();
      await runHttpTransformCopy("curl");
      return;
    }

    if (doesKeyboardEventMatchShortcut(event, shortcuts.copyPageUrl)) {
      event.preventDefault();
      event.stopPropagation();
      await runPageCopy();
      return;
    }
  }

  function onStorageChanged(
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string,
  ): void {
    if (areaName !== "local") return;
    if (!changes.yank_settings) return;

    settingsState = mergeSettings(changes.yank_settings.newValue as Partial<YankSettings> | undefined);
    syncModePill();
    helpMenu.update(buildHelpMenuData(settingsState));
  }

  function onJsonKeyClick(event: Event): void {
    if (!currentSettings().jsonTooling.decorateJsonBlocks) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const keyElement = target.closest(".yank-json-key") as HTMLElement | null;
    if (!keyElement) return;

    const path = keyElement.dataset.yankPath;
    if (!path) return;

    event.preventDefault();
    event.stopPropagation();

    void writeClipboardText(path).then((ok) => {
      showToast(ok ? `Path copied: ${path}` : "Could not copy JSON path to clipboard. Keep this tab focused and try again.", {
        kind: ok ? "success" : "error",
      });
    });
  }

  function onSelectionChanged(): void {
    if (!currentSettings().autoCopy.enabled) return;
    scheduleAutoCopy();
  }

  async function bootstrap(): Promise<void> {
    await refreshState();
    modePill = createModePill("");
    syncModePill();

    const keydownListener = (event: KeyboardEvent): void => {
      if (
        isEditableElement(event.target)
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey
      ) return;
      void keydownHandler(event).catch((error) => {
        closeTransientPanels();
        console.error("[Yank] key action failed", error);
        showToast("Action failed. Open panels were closed.", { kind: "error", dismissMs: 1700 });
      });
    };
    const pointerMoveListener = (event: PointerEvent): void => {
      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      hoveredCodeElement = closestCodeContainerFromNode(event.target as Node | null);
    };
    const visibilityChangeListener = (): void => {
      if (document.visibilityState !== "visible") {
        closeTransientPanels();
      }
    };
    const pageHideListener = (): void => {
      closeTransientPanels();
    };
    const blurListener = (): void => {
      closeTransientPanels();
    };

    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    browser.storage.onChanged.addListener(onStorageChanged);
    document.addEventListener("keydown", keydownListener, true);
    document.addEventListener("pointermove", pointerMoveListener, true);
    document.addEventListener("selectionchange", onSelectionChanged, true);
    document.addEventListener("copy", maybeTransformCopyEvent, true);
    document.addEventListener("click", onJsonKeyClick, true);
    document.addEventListener("visibilitychange", visibilityChangeListener, true);
    window.addEventListener("pagehide", pageHideListener, true);
    window.addEventListener("blur", blurListener, true);

    const mutationObserver = new MutationObserver(() => {
      if (currentSettings().jsonTooling.decorateJsonBlocks) {
        scheduleJsonBlockDecoration();
      }
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (currentSettings().jsonTooling.decorateJsonBlocks) {
      scheduleJsonBlockDecoration();
    }

    await notifyContentReady();

    window.__yankCleanup = () => {
      modePill.destroy();
      helpMenu.destroy();
      if (autoCopyTimer != null) window.clearTimeout(autoCopyTimer);
      if (jsonDecorationTimer != null) window.clearTimeout(jsonDecorationTimer);
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      browser.storage.onChanged.removeListener(onStorageChanged);
      mutationObserver.disconnect();
      document.removeEventListener("keydown", keydownListener, true);
      document.removeEventListener("pointermove", pointerMoveListener, true);
      document.removeEventListener("selectionchange", onSelectionChanged, true);
      document.removeEventListener("copy", maybeTransformCopyEvent, true);
      document.removeEventListener("click", onJsonKeyClick, true);
      document.removeEventListener("visibilitychange", visibilityChangeListener, true);
      window.removeEventListener("pagehide", pageHideListener, true);
      window.removeEventListener("blur", blurListener, true);
      if (document.documentElement.hasAttribute(INSTANCE_LOCK_ATTR)) {
        document.documentElement.removeAttribute(INSTANCE_LOCK_ATTR);
      }
    };
  }

  void bootstrap().catch((error) => {
    console.error("[Yank] content bootstrap failed", error);
  });
}
