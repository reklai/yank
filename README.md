# yank

Smart clipboard extension inspired by Harpoon Telescope structure.

## Features

- Defaults are Off: Auto-Copy is disabled and JSON Tools mode is Off.
- Configurable shortcuts in options for Auto-Copy toggle, JSON Tools picker, URL copy, clean code copy, and Fetch/cURL transforms.
- Default shortcuts: `Alt+T` (Auto-Copy toggle), `Alt+D` (JSON Tools picker), `Alt+C` (URL), `Alt+Shift+C` (clean code), `Alt+F` (Fetch), `Alt+Shift+F` (cURL).
- `Alt+M` is reserved to toggle a separate Help Menu overlay with live panel/mode/action keybinds.
- JSON Tools picker quick keys are configurable (default `0/1/2/3` for Off/Pretty Print/Path Copy/Markdown Table). Picker rows and Help Menu always reflect current quick keys.
- JSON Tools picker is keyboard + mouse friendly: click, `Enter`, wheel, arrows, and `j/k` navigation.
- Picker/footer and Help Menu are responsive for desktop/tablet/narrow widths.
- Existing tabs are backfilled with the content script on install/startup, with active-tab injection fallback for reliability.
- Auto-Copy and JSON Tools can coexist (independent settings).
- Auto-Copy: selection copy with plain-text, append, source-tag, site filtering, and selection count badge options.
- JSON Tools modes:
  - Off: copy unchanged
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
