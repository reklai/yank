const PICKER_OVERLAY_ID = "yank-choice-picker-overlay";
const HELP_MENU_OVERLAY_ID = "yank-help-menu-overlay";

export interface ChoicePickerOption {
  id: string;
  label: string;
  description: string;
  quickKey?: string;
  hotkeyHint?: string;
}

interface PickerState {
  resolve: (value: string | null) => void;
  cleanup: () => void;
}

let activePicker: PickerState | null = null;

function closeActivePicker(value: string | null): void {
  if (!activePicker) return;
  const { resolve, cleanup } = activePicker;
  activePicker = null;
  cleanup();
  resolve(value);
}

function normalizeQuickKey(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value.length !== 1) return "";
  if (!/^[\x21-\x7e]$/.test(value)) return "";
  return value;
}

function displayQuickKey(key: string): string {
  return /^[a-z]$/.test(key) ? key.toUpperCase() : key;
}

export function openChoicePicker(
  title: string,
  options: ChoicePickerOption[],
  initialIndex = 0,
): Promise<string | null> {
  closeActivePicker(null);

  return new Promise((resolve) => {
    if (options.length === 0) {
      resolve(null);
      return;
    }

    const existing = document.getElementById(PICKER_OVERLAY_ID);
    if (existing) existing.remove();

    let selectedIndex = Math.max(0, Math.min(initialIndex, options.length - 1));
    const quickKeyToIndex = new Map<string, number>();
    options.forEach((option, index) => {
      const key = normalizeQuickKey(option.quickKey || "");
      if (!key || quickKeyToIndex.has(key)) return;
      quickKeyToIndex.set(key, index);
    });

    const overlay = document.createElement("div");
    overlay.id = PICKER_OVERLAY_ID;
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.32)",
      "backdrop-filter:blur(2px)",
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "width:min(620px, calc(100vw - 28px))",
      "max-height:min(84vh, 640px)",
      "overflow:auto",
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
      "font-weight:600",
      "color:#9bc6ff",
      "text-align:center",
    ].join(";");
    header.textContent = title;

    const list = document.createElement("div");
    list.style.cssText = [
      "display:flex",
      "flex-direction:column",
      "padding:10px",
      "gap:8px",
    ].join(";");

    const rows: HTMLButtonElement[] = [];

    function paintRows(): void {
      rows.forEach((row, index) => {
        const isActive = index === selectedIndex;
        row.style.borderColor = isActive ? "rgba(254,188,46,0.95)" : "rgba(255,255,255,0.12)";
        row.style.background = isActive ? "rgba(254,188,46,0.14)" : "rgba(255,255,255,0.04)";
        row.style.color = isActive ? "#ffe4a6" : "#d2ddee";
      });
    }

    function moveSelection(delta: number): void {
      const total = options.length;
      selectedIndex = (selectedIndex + delta + total) % total;
      paintRows();
    }

    function selectCurrent(): void {
      closeActivePicker(options[selectedIndex]?.id ?? null);
    }

    options.forEach((option, index) => {
      const row = document.createElement("button");
      row.type = "button";
      row.style.cssText = [
        "width:100%",
        "text-align:left",
        "border:1px solid rgba(255,255,255,0.12)",
        "background:rgba(255,255,255,0.04)",
        "border-radius:10px",
        "padding:12px",
        "min-height:48px",
        "touch-action:manipulation",
        "cursor:pointer",
        "transition:background 0.12s ease,border-color 0.12s ease,color 0.12s ease",
      ].join(";");

      const titleLine = document.createElement("div");
      titleLine.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

      const label = document.createElement("span");
      const key = normalizeQuickKey(option.quickKey || "");
      label.textContent = key ? `[${displayQuickKey(key)}] ${option.label}` : option.label;

      const hotkeyHint = document.createElement("span");
      hotkeyHint.style.cssText = "font-size:11px;color:#9ca8ba";
      hotkeyHint.textContent = option.hotkeyHint || "";

      titleLine.append(label, hotkeyHint);

      const description = document.createElement("div");
      description.style.cssText = "margin-top:4px;font-size:12px;color:#9ca8ba";
      description.textContent = option.description;

      row.append(titleLine, description);
      row.addEventListener("mouseenter", () => {
        selectedIndex = index;
        paintRows();
      });
      row.addEventListener("click", () => {
        selectedIndex = index;
        selectCurrent();
      });

      rows.push(row);
      list.appendChild(row);
    });

    const footer = document.createElement("div");
    footer.style.cssText = [
      "padding:10px 14px 12px",
      "border-top:1px solid rgba(255,255,255,0.08)",
      "display:grid",
      "grid-template-columns:repeat(3, minmax(0, 1fr))",
      "gap:8px",
      "justify-items:center",
      "text-align:center",
      "font-size:12px",
      "color:#98a6bb",
      "align-items:center",
    ].join(";");

    const footerSelect = document.createElement("div");
    footerSelect.innerHTML = "Mouse Click | Enter: <strong>Select</strong>";

    const footerMove = document.createElement("div");
    footerMove.innerHTML = "Mouse Wheel | Arrow Keys | j/k: <strong>Navigate</strong>";

    const footerClose = document.createElement("div");
    footerClose.innerHTML = "Esc: <strong>Close picker</strong> | Alt+M: <strong>Help</strong>";

    footer.append(footerSelect, footerMove, footerClose);

    function applyResponsiveLayout(): void {
      const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);

      const columns = viewportWidth <= 620 ? 1 : viewportWidth <= 920 ? 2 : 3;
      footer.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;

      if (columns === 1) {
        footer.style.justifyItems = "stretch";
        footerSelect.style.gridColumn = "1";
        footerMove.style.gridColumn = "1";
        footerClose.style.gridColumn = "1";
      } else if (columns === 2) {
        footer.style.justifyItems = "center";
        footerSelect.style.gridColumn = "1";
        footerMove.style.gridColumn = "2";
        footerClose.style.gridColumn = "1 / span 2";
      } else {
        footer.style.justifyItems = "center";
        footerSelect.style.gridColumn = "1";
        footerMove.style.gridColumn = "2";
        footerClose.style.gridColumn = "3";
      }
    }

    function keydownListener(event: KeyboardEvent): void {
      if (document.getElementById(HELP_MENU_OVERLAY_ID)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeActivePicker(null);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        selectCurrent();
        return;
      }

      const lower = event.key.toLowerCase();
      if (event.key === "ArrowDown" || lower === "j") {
        event.preventDefault();
        event.stopPropagation();
        moveSelection(1);
        return;
      }

      if (event.key === "ArrowUp" || lower === "k") {
        event.preventDefault();
        event.stopPropagation();
        moveSelection(-1);
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const quickKey = normalizeQuickKey(event.key);
      if (!quickKey) return;

      const index = quickKeyToIndex.get(quickKey);
      if (index == null) return;

      event.preventDefault();
      event.stopPropagation();
      selectedIndex = index;
      selectCurrent();
    }

    function wheelListener(event: WheelEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY === 0) return;
      moveSelection(event.deltaY > 0 ? 1 : -1);
    }

    function overlayClickListener(event: MouseEvent): void {
      if (event.target === overlay) {
        closeActivePicker(null);
      }
    }

    card.append(header, list, footer);
    overlay.appendChild(card);
    document.documentElement.appendChild(overlay);
    paintRows();
    applyResponsiveLayout();

    document.addEventListener("keydown", keydownListener, true);
    overlay.addEventListener("wheel", wheelListener, { passive: false, capture: true });
    overlay.addEventListener("click", overlayClickListener);
    window.addEventListener("resize", applyResponsiveLayout);

    activePicker = {
      resolve,
      cleanup: () => {
        document.removeEventListener("keydown", keydownListener, true);
        overlay.removeEventListener("wheel", wheelListener, true);
        overlay.removeEventListener("click", overlayClickListener);
        window.removeEventListener("resize", applyResponsiveLayout);
        overlay.remove();
      },
    };
  });
}
