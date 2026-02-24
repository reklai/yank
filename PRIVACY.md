# Privacy Policy — Yank

**Last updated:** February 24, 2026

## Summary

Yank does not collect, transmit, or share your data.
All functionality runs locally in your browser.
No account is required. No cloud sync is used.

## Data Storage

Yank stores settings locally in your browser using `browser.storage.local` under:

- `yank_settings` — extension settings (shortcuts, Auto-Copy options, URL copy options, JSON Tools options)

This data stays on your machine and is not sent to remote services.

## Data Processing (Local Runtime Only)

To provide features, Yank processes data in memory on your device:

- Selected text for Auto-Copy and JSON Tools transforms
- Current page URL for URL copy
- Nearby/selected code blocks for clean code copy and request transforms
- Clipboard content for fallback parsing in Fetch/cURL transforms
- Open tab context for command routing and active-tab actions

Processing is local and not transmitted externally.

## Data Collection

None. Yank:

- Does not collect analytics or telemetry
- Does not make network requests to external servers/APIs
- Does not use cookies
- Does not load remote scripts/code
- Does not use `eval()` or dynamic code execution
- Does not fingerprint users/devices

## Permissions Explained

| Permission | Why it's needed |
|------------|-----------------|
| `tabs` | Route extension commands/messages to the active tab |
| `activeTab` | Execute active-tab actions (for example copy current page URL) |
| `storage` | Persist your local extension settings |
| `clipboardRead` | Read clipboard text fallback for request transforms |
| `clipboardWrite` | Write copied/transformed output to clipboard |
| `<all_urls>` / `host_permissions` | Run content features on pages where you use the extension |
| `scripting` (MV3 only) | Inject content script when needed in Chrome builds |

## Third Parties

No third-party services are used for data transfer.
`webextension-polyfill` is used as a local runtime compatibility layer only.

## Data Sharing

None. Yank does not sell, rent, or disclose data to third parties.

## Data Retention

Local settings remain until you remove them (for example uninstalling the extension or clearing extension storage).

## Data Deletion

You can clear all stored data by:

1. Uninstalling the extension
2. Clearing extension storage in browser developer tools

## Changes to This Policy

Policy updates are published in this file and the "Last updated" date is revised accordingly.

## Contact

If you have privacy questions, open an issue in the project repository.
