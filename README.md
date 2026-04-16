# PoE2 Campaign Tracker

A desktop companion for Path of Exile 2 campaign runs — built with Tauri, React, and TypeScript.

Tracks your act-by-act progression with a guide panel, per-act run splits, a craftable build plan (gear + skill gems), and Path of Building import/export.

## Features

- **Campaign guide** — Act-by-act walkthrough synced to your character's zone (via `Client.txt`). Includes a full in-app editor so you can fork the default guide and build your own.
- **Run history + timer** — Per-act splits with best/worst coloring, sortable by recency or fastest, auto-advances on zone change.
- **Build plan** — Multi-phase gear layout (weapons, armour, jewelry, augments/runes) and skill-gem groups. Includes an item/mod database and a craft UI that computes roll values.
- **Path of Building import/export**
  - Paste a PoB PoE2 build code → creates one build phase per PoB item set with matched gear + skill groups + mod rolls.
  - Copy any crafted gear slot as a PoB-compatible item text block for round-tripping back into PoB.
- **Vendor regex + watchlist** — Generate regex strings for vendor searches, track items you're hunting.

## Stack

- [Tauri 2](https://tauri.app) (Rust backend, native desktop)
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 7](https://vitejs.dev) (build) + [Vitest 4](https://vitest.dev) (tests)
- [Zustand 5](https://github.com/pmndrs/zustand) (state)
- [@dnd-kit](https://dndkit.com) (drag-reorder)
- [pako](https://github.com/nodeca/pako) (zlib for PoB codec)

## Getting started

Prerequisites: Node.js 20+, Rust toolchain (for Tauri), and the platform-specific Tauri dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

To build a release bundle:

```bash
npm run tauri build
```

Run the test suite:

```bash
npm test
```

## Configuration

On first launch, open **Settings → Client.txt Path** and paste the full path to your PoE2 `Client.txt` log file (used to detect zone changes and auto-advance the guide).

## Data sources

Base items, mods, uniques, and skill gems are derived from [RePoE](https://github.com/lvlvllvlvllvlvl/RePoE) and [poe2db](https://poe2db.tw). The default campaign guide is based on Mobalytics campaign route.

## Cutting a release

Push a `v*` tag and GitHub Actions builds a Windows installer and publishes it as a draft release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then open the Releases page, fill in notes on the draft, and publish. Or trigger manually via **Actions → Release → Run workflow**.

## License

Personal project — no license specified. Reach out before re-using substantial portions.
