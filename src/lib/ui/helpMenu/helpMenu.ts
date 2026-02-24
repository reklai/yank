export const HELP_MENU_OVERLAY_ID = "yank-help-menu-overlay";

type JsonModeLabel = "Off" | "Pretty Print" | "Path Copy" | "Markdown Table";

export interface HelpMenuData {
  shortcuts: ShortcutSettings;
  autoCopyEnabled: boolean;
  jsonModeLabel: JsonModeLabel;
}

export interface HelpMenuController {
  toggle(data: HelpMenuData): void;
  hide(): void;
  update(data: HelpMenuData): void;
  isVisible(): boolean;
  destroy(): void;
}

function formatShortcut(shortcut: string): string {
  const trimmed = shortcut.trim();
  return trimmed ? trimmed : "Unbound";
}

function createKeyBadge(value: string): HTMLElement {
  const badge = document.createElement("kbd");
  badge.style.cssText = [
    "padding:2px 8px",
    "border-radius:999px",
    "border:1px solid rgba(255,255,255,0.2)",
    "background:rgba(255,255,255,0.06)",
    "color:#ffe4a6",
    "font:12px/1.4 'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
    "white-space:nowrap",
  ].join(";");
  badge.textContent = value;
  return badge;
}

function createInfoLine(text: string): HTMLElement {
  const line = document.createElement("div");
  line.style.cssText = "font-size:12px;color:#b8c7db;line-height:1.45";
  line.textContent = text;
  return line;
}

function createInfoCard(input: {
  title: string;
  key?: string;
  lines: string[];
}): HTMLElement {
  const card = document.createElement("article");
  card.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "padding:12px",
    "border:1px solid rgba(155,198,255,0.24)",
    "border-radius:11px",
    "background:linear-gradient(180deg, rgba(58,76,102,0.26), rgba(255,255,255,0.06))",
    "box-shadow:0 10px 22px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
    "min-width:0",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:8px",
  ].join(";");

  const title = document.createElement("div");
  title.style.cssText = "font-weight:600;color:#d8e8ff";
  title.textContent = input.title;

  header.appendChild(title);
  if (input.key) {
    header.appendChild(createKeyBadge(input.key));
  }

  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:3px";
  for (const line of input.lines) {
    body.appendChild(createInfoLine(line));
  }

  card.append(header, body);
  return card;
}

function createSection(title: string, cards: HTMLElement[]): HTMLElement {
  const section = document.createElement("section");
  section.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:10px",
  ].join(";");

  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:600;color:#9bc6ff;letter-spacing:0.02em";
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.style.cssText = [
    "display:grid",
    "grid-template-columns:repeat(auto-fit, minmax(260px, 1fr))",
    "gap:10px",
  ].join(";");
  for (const card of cards) {
    grid.appendChild(card);
  }

  section.append(heading, grid);
  return section;
}

export function createHelpMenu(): HelpMenuController {
  let overlay: HTMLDivElement | null = null;
  let card: HTMLDivElement | null = null;
  let cardBody: HTMLDivElement | null = null;
  let resizeListenerAttached = false;

  function applyResponsiveLayout(): void {
    if (!overlay || !card || !cardBody) return;

    const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
    const isPhoneWidth = viewportWidth <= 640;
    const isTabletWidth = viewportWidth <= 960;

    overlay.style.paddingTop = isPhoneWidth
      ? "calc(10px + env(safe-area-inset-top, 0px))"
      : "calc(76px + env(safe-area-inset-top, 0px))";

    card.style.width = isPhoneWidth
      ? "calc(100vw - 12px)"
      : isTabletWidth
        ? "min(860px, calc(100vw - 20px))"
        : "min(920px, calc(100vw - 28px))";
    card.style.maxHeight = isPhoneWidth ? "92vh" : "min(82vh, 760px)";

    cardBody.style.padding = isPhoneWidth ? "10px" : "12px";
    cardBody.style.gap = isPhoneWidth ? "10px" : "12px";
  }

  function ensureElements(): void {
    if (overlay && card && cardBody) return;

    overlay = document.createElement("div");
    overlay.id = HELP_MENU_OVERLAY_ID;
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:flex-start",
      "justify-content:center",
      "padding-top:calc(76px + env(safe-area-inset-top, 0px))",
      "background:rgba(0,0,0,0.28)",
      "backdrop-filter:blur(2px)",
      "pointer-events:auto",
    ].join(";");

    card = document.createElement("div");
    card.tabIndex = 0;
    card.style.cssText = [
      "width:min(920px, calc(100vw - 28px))",
      "max-height:min(82vh, 760px)",
      "overflow:auto",
      "outline:none",
      "border-radius:14px",
      "border:1px solid rgba(255,255,255,0.16)",
      "background:rgba(32,32,32,0.98)",
      "box-shadow:0 28px 54px rgba(0,0,0,0.5)",
      "font:13px/1.4 'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
      "color:#d8e8ff",
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = [
      "padding:10px 14px",
      "border-bottom:1px solid rgba(255,255,255,0.08)",
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:10px",
    ].join(";");

    const title = document.createElement("div");
    title.style.cssText = "font-weight:600;color:#9bc6ff";
    title.textContent = "Yank Help Menu";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.style.cssText = [
      "padding:4px 8px",
      "border-radius:6px",
      "border:1px solid rgba(255,255,255,0.2)",
      "background:rgba(255,255,255,0.06)",
      "color:#d8e8ff",
      "cursor:pointer",
      "font:12px/1.2 'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
    ].join(";");
    close.addEventListener("click", () => {
      hide();
    });

    header.append(title, close);

    cardBody = document.createElement("div");
    cardBody.style.cssText = [
      "padding:12px",
      "display:flex",
      "flex-direction:column",
      "gap:12px",
    ].join(";");

    const footer = document.createElement("div");
    footer.style.cssText = [
      "padding:10px 14px 12px",
      "border-top:1px solid rgba(255,255,255,0.08)",
      "font-size:12px",
      "color:#98a6bb",
      "text-align:center",
    ].join(";");
    footer.textContent = "Alt+M: Toggle Help Menu | Esc: Close";

    card.append(header, cardBody, footer);
    overlay.appendChild(card);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        hide();
      }
    });

    overlay.addEventListener("keydown", (event: KeyboardEvent) => {
      if (!card) return;
      const lower = event.key.toLowerCase();
      if (event.key === "ArrowDown" || lower === "j") {
        event.preventDefault();
        event.stopPropagation();
        card.scrollBy({ top: 48 });
        return;
      }
      if (event.key === "ArrowUp" || lower === "k") {
        event.preventDefault();
        event.stopPropagation();
        card.scrollBy({ top: -48 });
      }
    }, true);

    overlay.addEventListener("wheel", (event: WheelEvent) => {
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      card.scrollBy({ top: event.deltaY });
    }, { passive: false, capture: true });

    if (!resizeListenerAttached) {
      window.addEventListener("resize", applyResponsiveLayout);
      resizeListenerAttached = true;
    }

    applyResponsiveLayout();
  }

  function render(data: HelpMenuData): void {
    if (!cardBody) return;
    cardBody.textContent = "";

    const quickStart = createSection("Quick Start", [
      createInfoCard({
        title: "Help Menu",
        key: "Alt+M",
        lines: [
          "Toggle this panel on/off.",
          "Press Esc to close.",
        ],
      }),
      createInfoCard({
        title: "Auto-Copy Status",
        key: formatShortcut(data.shortcuts.switchToAutoCopy),
        lines: [
          `Current: ${data.autoCopyEnabled ? "On" : "Off"}.`,
          "Toggle to copy selected text automatically.",
        ],
      }),
      createInfoCard({
        title: "JSON Tools Status",
        lines: [
          "No dedicated Off key: press active JSON mode key again to turn Off.",
        ],
      }),
    ]);

    const actions = createSection("Actions", [
      createInfoCard({
        title: "Copy Current Page URL",
        key: formatShortcut(data.shortcuts.copyPageUrl),
        lines: [
          "Do: Press this key on any page.",
          "Input: current tab URL.",
          "Result: raw URL copied.",
        ],
      }),
      createInfoCard({
        title: "Copy Clean Code Block",
        key: formatShortcut(data.shortcuts.copyCleanCodeBlock),
        lines: [
          "Do: Select code (or place cursor/hover near code) then press key.",
          "Input: selection -> caret/focus code -> hovered/nearest code block.",
          "Result: cleaned code copied.",
        ],
      }),
      createInfoCard({
        title: "Copy as Fetch",
        key: formatShortcut(data.shortcuts.copyAsFetch),
        lines: [
          "Do: Select request text and press key.",
          "Input: selection -> code source -> clipboard fallback.",
          "Result: fetch(...) code copied.",
        ],
      }),
      createInfoCard({
        title: "Copy as cURL",
        key: formatShortcut(data.shortcuts.copyAsCurl),
        lines: [
          "Do: Select request text and press key.",
          "Input: selection -> code source -> clipboard fallback.",
          "Result: curl command copied.",
        ],
      }),
    ]);

    const jsonModes = createSection("JSON Tools Modes", [
      createInfoCard({
        title: "Off",
        lines: [
          "No dedicated Off keybind.",
          "Press the currently active JSON mode key again.",
          "Copy behavior stays unchanged.",
        ],
      }),
      createInfoCard({
        title: "Pretty Print",
        key: formatShortcut(data.shortcuts.jsonToolingPrettyPrint),
        lines: [
          "Press key to enable Pretty Print.",
          "Press same key again to toggle Off.",
        ],
      }),
      createInfoCard({
        title: "Path Copy",
        key: formatShortcut(data.shortcuts.jsonToolingPathCopy),
        lines: [
          "Press key to enable Path Copy.",
          "Click JSON keys in decorated blocks to copy full paths.",
        ],
      }),
      createInfoCard({
        title: "Markdown Table",
        key: formatShortcut(data.shortcuts.jsonToolingMarkdownTable),
        lines: [
          "Press key to enable Markdown Table.",
          "Press same key again to toggle Off.",
        ],
      }),
    ]);

    cardBody.append(quickStart, actions, jsonModes);
  }

  function show(data: HelpMenuData): void {
    ensureElements();
    render(data);
    if (!overlay || document.contains(overlay)) return;
    document.documentElement.appendChild(overlay);
    applyResponsiveLayout();
    card?.focus();
  }

  function hide(): void {
    overlay?.remove();
  }

  function toggle(data: HelpMenuData): void {
    if (overlay && document.contains(overlay)) {
      hide();
      return;
    }
    show(data);
  }

  function update(data: HelpMenuData): void {
    if (!overlay || !document.contains(overlay)) return;
    render(data);
  }

  function isVisible(): boolean {
    return Boolean(overlay && document.contains(overlay));
  }

  function destroy(): void {
    hide();
    if (resizeListenerAttached) {
      window.removeEventListener("resize", applyResponsiveLayout);
      resizeListenerAttached = false;
    }
    overlay = null;
    card = null;
    cardBody = null;
  }

  return {
    toggle,
    hide,
    update,
    isVisible,
    destroy,
  };
}
