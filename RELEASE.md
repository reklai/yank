# Release Runbook

This file defines how to produce reproducible Yank extension artifacts from source.

## Environment Requirements

- OS: Linux, macOS, or Windows
- Node.js: 21.x (or compatible)
- npm: 10.x (or compatible)
- `zip` CLI in `PATH`

## Install Dependencies

```sh
npm ci
```

## Build Targets

- Firefox (MV2): `npm run build:firefox`
- Chrome (MV3): `npm run build:chrome`

Both targets compile from the same TypeScript source; manifest selection is target-specific.

## Quality Gate

Run before packaging:

```sh
npm run typecheck
npm run test
```

## Package Release Artifacts

```sh
VERSION=$(node -p "require('./package.json').version")
mkdir -p release

# Firefox artifact (.xpi)
npm run build:firefox
(cd dist && zip -qr "../release/yank-firefox-v${VERSION}.xpi" .)

# Chrome artifact (.zip)
npm run build:chrome
(cd dist && zip -qr "../release/yank-chrome-v${VERSION}.zip" .)
```

## Optional Source Archive

```sh
VERSION=$(node -p "require('./package.json').version")
mkdir -p release
zip -qr "release/yank-source-v${VERSION}.zip" . \
  -x ".git/*" "dist/*" "node_modules/*" "release/*"
```

## Build Pipeline Entry Point

- `esBuildConfig/build.mjs`

Pipeline responsibilities:

1. Bundle TypeScript entry points with esbuild.
2. Copy static assets (manifest, HTML, CSS, icons) into `dist/`.
3. Select target manifest (`manifest_v2.json` or `manifest_v3.json`).
