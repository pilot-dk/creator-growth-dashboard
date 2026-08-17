# Contributing

Issues and PRs are welcome.

## Development

```bash
npm install
npm run dev
```

This starts the app in development mode with hot reload for the renderer.

## Type-checking & building

```bash
npm run typecheck
npm run build        # builds main/preload/renderer into out/
npm run build:mac    # additionally packages a macOS app into release/
```

## Project layout

```
src/
  main/        Electron main process — OAuth flows, API clients, local storage, background poller
  preload/     contextBridge API exposed to the renderer (window.api)
  renderer/    React + TypeScript UI (Vite)
  shared/      Types and constants shared between main and renderer
```

## App icon

The icon is generated rather than checked in by hand:

```bash
python3 scripts/make-icon.py
```

This writes `build/icon.icns` (used by electron-builder) and `build/icon.png`.
Edit the colors or bar geometry at the top of the script and re-run to change it.

## Releasing

Push a tag matching `v*` (e.g. `v0.2.0`) and the `Release macOS build` GitHub
Actions workflow will build and publish a macOS release automatically.
