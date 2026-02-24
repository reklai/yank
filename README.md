# yank

Smart clipboard extension inspired by Neovim Yank concept.

## Features

- Defaults are Off: Auto-Copy is disabled and JSON Tools mode is Off.
- Configurable shortcuts in options for Auto-Copy toggle, direct JSON mode switching, URL copy, clean code copy, and Fetch/cURL transforms.
- Default shortcuts: `Alt+T` (Auto-Copy toggle), `Alt+D` (JSON Pretty Print), `Alt+Shift+D` (JSON Path Copy), `Alt+Shift+T` (JSON Markdown Table), `Alt+C` (URL), `Alt+Shift+C` (clean code), `Alt+F` (Fetch), `Alt+Shift+F` (cURL).
- `Alt+M` is reserved to toggle a separate Help Menu overlay. JSON Tools Status is description-only (no keybind badge); mode/action cards still show live keybinds.
- JSON mode shortcuts are toggle + swap aware: there is no separate Off shortcut. Pressing an already-active mode turns JSON Tools Off; pressing another mode switches immediately.
- Help Menu is responsive for desktop/tablet/narrow widths.
- Existing tabs are backfilled with the content script on install/startup, with active-tab injection fallback for reliability.
- Auto-Copy and JSON Tools can coexist (independent settings).
- Auto-Copy: selection copy with plain-text, append, source-tag, site filtering, and selection count badge options.
- JSON Tools modes:
  - Off: no dedicated keybind; press the active JSON mode key again, then copy unchanged
  - Pretty Print: valid selected JSON is reformatted on copy
  - Path Copy: clicking decorated JSON keys copies full paths
  - Markdown Table: JSON array-of-objects converts to Markdown table on copy

## Development

```bash
npm install
npm run build:firefox
npm run build:chrome
npm run typecheck
```

## Docs Map

- Release packaging runbook: `RELEASE.md`
- Store listing reference: `STORE.md`
- Privacy policy: `PRIVACY.md`

## License

MIT - see `LICENSE`.
