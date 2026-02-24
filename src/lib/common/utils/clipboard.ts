let fallbackClipboardBuffer = "";

export async function readClipboardText(): Promise<string> {
  try {
    const text = await navigator.clipboard.readText();
    fallbackClipboardBuffer = text;
    return text;
  } catch {
    return fallbackClipboardBuffer;
  }
}

function fallbackWriteText(text: string): boolean {
  const activeElement = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(textarea);

  if (selectedRange && selection) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  if (activeElement) {
    activeElement.focus({ preventScroll: true });
  }

  return ok;
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    fallbackClipboardBuffer = text;
    return true;
  } catch {
    const ok = fallbackWriteText(text);
    if (ok) fallbackClipboardBuffer = text;
    return ok;
  }
}

export async function appendClipboardText(fragment: string, separator: string): Promise<string> {
  const existing = await readClipboardText();
  const next = existing ? `${existing}${separator}${fragment}` : fragment;
  await writeClipboardText(next);
  return next;
}
