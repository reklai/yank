const MODE_PILL_ID = "yank-mode-pill";

export interface ModePillController {
  setText(text: string): void;
  setVisible(visible: boolean): void;
  flash(): void;
  destroy(): void;
}

export function createModePill(initialText: string): ModePillController {
  const existing = document.getElementById(MODE_PILL_ID);
  if (existing) existing.remove();

  const pill = document.createElement("div");
  pill.id = MODE_PILL_ID;
  pill.style.cssText = [
    "position:fixed",
    "left:50%",
    "transform:translateX(-50%)",
    "top:calc(12px + env(safe-area-inset-top, 0px))",
    "z-index:2147483647",
    "display:none",
    "align-items:center",
    "gap:10px",
    "padding:8px 12px",
    "border-radius:999px",
    "border:1px solid rgba(255,255,255,0.14)",
    "background:rgba(37,37,37,0.95)",
    "color:#a8d2ff",
    "font:12px/1.3 'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
    "box-shadow:0 12px 28px rgba(0,0,0,0.45)",
    "backdrop-filter:blur(6px)",
    "pointer-events:auto",
  ].join(";");

  const text = document.createElement("span");
  text.style.cssText = "white-space:nowrap";

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "x";
  dismiss.title = "Dismiss";
  dismiss.style.cssText = [
    "border:none",
    "background:rgba(255,255,255,0.08)",
    "color:#c6c6c6",
    "width:18px",
    "height:18px",
    "border-radius:50%",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font:12px/1 monospace",
  ].join(";");

  dismiss.addEventListener("click", () => {
    pill.remove();
  });

  pill.append(text, dismiss);
  document.documentElement.appendChild(pill);

  function setText(value: string): void {
    text.textContent = value;
  }

  function setVisible(visible: boolean): void {
    pill.style.display = visible ? "flex" : "none";
  }

  function flash(): void {
    pill.animate(
      [
        { transform: "translateX(-50%) translateY(6px)", opacity: 0.6 },
        { transform: "translateX(-50%) translateY(0)", opacity: 1 },
      ],
      { duration: 180, easing: "ease-out" },
    );
  }

  setText(initialText);

  return {
    setText,
    setVisible,
    flash,
    destroy() {
      pill.remove();
    },
  };
}
