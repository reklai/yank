# Yank

Yank is a keyboard-first clipboard extension for browser-based developer workflows.

It focuses on one thing: making copy actions fast and predictable on any page.

## What Yank Does

- Copies the exact current page URL.
- Auto-copies selected text when Auto-Copy is enabled.
- Applies JSON copy transforms (Pretty Print, Path Copy, Markdown Table).
- Copies clean code blocks from selection/focus/hover/nearby code.
- Shows in-page status/toasts and a Help Menu with live keybinds.

Defaults:
- Auto-Copy is Off.
- JSON Tools is Off.

## Feature Details

### 1) Copy current page URL
- Action: copy raw `location.href` of the active tab.
- Output: exact URL string.

### 2) Auto-Copy on selection
- When enabled, text selection is copied without pressing Ctrl/Cmd+C.
- Options:
  - Plain text mode
  - Append mode + custom separator
  - Source tag mode (append page URL)
  - Per-site whitelist/blacklist rules
  - Selection character count badge

### 3) JSON Tools (one mode active at a time)
- Pretty Print: reformat valid JSON for readability.
- Path Copy: click decorated JSON keys to copy full path.
- Markdown Table: convert JSON array-of-objects to a Markdown table.
- Off behavior: press the currently active JSON mode shortcut again.
- Input resolution order for copy transforms:
  - selection
  - nearby code block
  - clipboard fallback
- Recovery parser accepts:
  - normal JSON
  - JSON inside code fences
  - escaped JSON strings
  - common JS-like object logs (single quotes, trailing commas, unquoted keys)
- If parse fails, toast includes actionable details (line/column + hint).

### 4) Clean code block copy
- Source priority:
  - current selection
  - focused code block
  - hovered code block
  - nearest code block
- Output: cleaned code text.

## Default Shortcuts

| Action | Default |
|---|---|
| Toggle Auto-Copy | `Alt+T` |
| Toggle JSON Tools: Pretty Print | `Alt+D` |
| Toggle JSON Tools: Path Copy | `Alt+Shift+D` |
| Toggle JSON Tools: Markdown Table | `Alt+Shift+T` |
| Copy current page URL | `Alt+C` |
| Copy clean code block | `Alt+Shift+C` |
| Toggle Help Menu (reserved) | `Alt+M` |

Notes:
- `Alt+M` is reserved and cannot be reassigned.
- Other shortcuts are configurable in Settings.
- Auto-Copy and JSON Tools can coexist.

## Quick Examples

### Pretty Print JSON

Input:

```json
{"user":{"id":1,"email":"a@b.com"}}
```

Output:

```json
{
  "user": {
    "id": 1,
    "email": "a@b.com"
  }
}
```

### JSON Path Copy

Given key click inside formatted JSON:

```json
{"user":{"roles":["admin"]}}
```

Copied path:

```text
response.data.user.roles[0]
```

### Markdown Table

Input:

```json
[{"name":"Alice","role":"admin"},{"name":"Bob","role":"viewer"}]
```

Output:

```text
| name  | role   |
|-------|--------|
| Alice | admin  |
| Bob   | viewer |
```

## Installation

### From source

Requirements:
- Node.js 21.x
- npm 10.x

```bash
npm ci
npm run build:firefox
# or
npm run build:chrome
```

### Load in browser

Firefox (temporary add-on):
1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select `dist/manifest.json`

Chrome:
1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `dist/`

## Configuration

Settings UI:
1. Open Yank popup.
2. Click `Open settings`.
3. Update options and shortcuts.
4. Save.

Browser shortcut manager:
- Firefox: `about:addons` -> gear icon -> `Manage Extension Shortcuts`
- Chrome: `chrome://extensions/shortcuts`

## Development

Build commands:

```bash
npm run build:firefox
npm run build:chrome
npm run watch
```

Quality gates:

```bash
npm run typecheck
npm run test
```

## Release

See `RELEASE.md` for exact packaging instructions.

Typical outputs:
- `release/yank-firefox-v<version>.xpi`
- `release/yank-chrome-v<version>.zip`
- `release/yank-store-icon-128.png`

## Project Layout

- `src/entryPoints/backgroundRuntime` - background runtime entry
- `src/entryPoints/contentScript` - content script entry
- `src/entryPoints/optionsPage` - settings page
- `src/entryPoints/toolbarPopup` - popup UI
- `src/lib` - feature logic, adapters, UI primitives, utilities
- `esBuildConfig` - build script and manifests

## Privacy

Yank processes data locally in-browser.

- No telemetry
- No external API calls
- No account requirement
- Settings stored in `browser.storage.local`

Full policy: `PRIVACY.md`

## Additional Docs

- `RELEASE.md` - release runbook
- `STORE.md` - store metadata and permission rationale
- `PRIVACY.md` - privacy policy

## License

MIT - see `LICENSE`.
