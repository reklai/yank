const TOAST_HOST_ID = "yank-toast-host";

function ensureToastHost(): HTMLDivElement {
  let host = document.getElementById(TOAST_HOST_ID) as HTMLDivElement | null;
  if (host) return host;

  host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  host.style.cssText = [
    "position:fixed",
    "left:50%",
    "transform:translateX(-50%)",
    "top:calc(56px + env(safe-area-inset-top, 0px))",
    "z-index:2147483647",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "gap:8px",
    "font-family:'SF Mono','JetBrains Mono','Fira Code','Consolas',monospace",
    "pointer-events:none",
  ].join(";");
  document.documentElement.appendChild(host);
  return host;
}

export function showToast(
  message: string,
  options: {
    kind?: "success" | "warning" | "error";
    dismissMs?: number;
  } = {},
): void {
  const host = ensureToastHost();
  const toast = document.createElement("div");
  const kind = options.kind || "success";

  const borderColor =
    kind === "error"
      ? "rgba(255,95,87,0.7)"
      : kind === "warning"
        ? "rgba(254,188,46,0.7)"
        : "rgba(50,215,75,0.7)";

  const textColor = kind === "error" ? "#ff7d76" : kind === "warning" ? "#ffd66e" : "#66e07a";

  toast.textContent = message;
  toast.style.cssText = [
    "max-width:480px",
    "padding:8px 12px",
    "border-radius:8px",
    "background:#252525",
    `border:1px solid ${borderColor}`,
    `color:${textColor}`,
    "font-size:12px",
    "line-height:1.35",
    "box-shadow:0 10px 26px rgba(0,0,0,0.45)",
    "opacity:0",
    "transform:translateY(8px)",
    "transition:opacity 0.18s ease, transform 0.18s ease",
    "pointer-events:auto",
    "cursor:pointer",
  ].join(";");

  const dismiss = (): void => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    window.setTimeout(() => {
      toast.remove();
      if (host.childElementCount === 0) {
        host.remove();
      }
    }, 170);
  };

  toast.addEventListener("click", dismiss);

  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(dismiss, options.dismissMs ?? 1800);
}
