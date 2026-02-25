# Store Reference — Yank

This document is a reference for store-facing metadata, product claims, and permission rationale.

## Extension Name

Yank

## Store Icon

- Upload file: `release/yank-store-icon-128.png`
- Format: PNG
- Size: 128x128
- Color mode: RGB (no alpha channel)

## Summary (short — AMO/CWS listing)

Keyboard-first clipboard utility: copy page URL, auto-copy selections, JSON transforms, and clean code copy.

## Description

Yank is a keyboard-first clipboard extension for developers and heavy browser users.
It keeps copy workflows fast and local.

Core capabilities:

- Copy current page URL instantly.
- Auto-Copy selected text (optional plain text, append mode, source tagging, and per-site controls).
- JSON Tools modes:
  - Pretty Print selected JSON on copy
  - Path Copy from decorated JSON blocks
  - Markdown Table conversion for JSON array-of-objects
  - Recovery parsing from selection -> nearby code block -> clipboard fallback with actionable parse-error toasts
- Clean code block copy from selection/caret/hover/nearby code blocks.
- Fully configurable shortcuts in Options with duplicate-shortcut guards.

Privacy and behavior claims:

- No telemetry, analytics, or external API calls.
- No cloud sync and no account requirement.
- Data is stored locally in extension storage (`browser.storage.local`).

## Tags / Keywords

clipboard, copy, productivity, developer tools, json, markdown, shortcuts, browser extension

## Permission Rationale (Store Submission Notes)

- **tabs**: route background command/message actions to the active tab.
- **activeTab**: execute tab-scoped actions (such as copy current page URL and content-script fallbacks).
- **storage**: persist local settings (shortcuts and feature options).
- **clipboardRead**: read clipboard text for JSON Tools fallback parsing when no selection/code block input is present.
- **clipboardWrite**: write copied/transformed content to clipboard.
- **host permissions (`<all_urls>`)**: enable content features on pages where user invokes Yank.
- **scripting (Chrome MV3 only)**: inject content script when needed if tab was open before install/startup.
