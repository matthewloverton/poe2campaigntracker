# PoE2 Campaign Tracker

A desktop companion for Path of Exile 2 campaign runs — built with Tauri, React, and TypeScript.

Tracks your act-by-act progression with a guide panel, per-act run splits, a craftable build plan (gear + skill gems), and Path of Building import/export.

<img width="1200" height="800" alt="image" src="https://github.com/user-attachments/assets/f7351104-572c-45be-a908-9e0d6bd756d0" />


## Features

- **Campaign guide** — Act-by-act walkthrough synced to your character's zone (via `Client.txt`). Includes a full in-app editor so you can fork the default guide and build your own.
- **Run history + timer** — Per-act splits with best/worst coloring, sortable by recency or fastest, auto-advances on zone change.
- **Build plan** — Multi-phase gear layout (weapons, armour, jewelry, augments/runes) and skill-gem groups, backed by a searchable item/mod database.
- **Craft emulator** — Arm-then-click currency simulator covering Transmute, Augment, Regal, Exalt, Chaos, Alchemy, Vaal, Divine, plus Greater/Perfect variants and the full essence strip (Lesser/Normal/Greater/Perfect + corrupted). Rolls use real per-base spawn weights; history is clickable to restore earlier states; favourite crafts survive restarts.
- **Item/mod database** — Browse every base + mod with tier labels, rolled(min-max) values, colour-coded tags, and source tabs for Normal / Essence / Desecrated / Corrupted mods.
- **Path of Building import/export**
  - Paste a PoB PoE2 build code → creates one build phase per PoB item set with matched gear + skill groups + mod rolls.
  - Copy any crafted gear slot as a PoB-compatible item text block for round-tripping back into PoB.
- **Vendor regex + watchlist** — Generate regex strings for vendor searches, track items you're hunting.
- **Auto-updater** — Signed updates delivered via GitHub releases; prompts on launch when a new version is available.

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

## Acknowledgements

This project stands on the shoulders of the wider PoE community. Huge thanks to:

- **[RePoE](https://github.com/lvlvllvlvllvlvl/RePoE)** — PoE2 fork that provides the base-item, mod, unique, and skill-gem JSON this app ingests.
- **[poe2db](https://poe2db.tw)** — authoritative game data reference used to cross-check mod weights, essences, and item stats.
- **[Path of Building Community](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)** — the PoB2 fork whose build-code format (Base64 + zlib) this app imports and exports.
- **[PoE2 Wiki](https://www.poe2wiki.net)** — essence tables and currency mechanics.
- **[poe2.mobalytics.gg](https://poe2.mobalytics.gg)** — the default campaign guide is based on their campaign route and zone layouts.
- **[Craft of Exile](https://www.craftofexile.com)** — essence toggle icon.
- **[Exile-UI](https://exile-ui.com)** — UI and interaction inspiration.

None of these projects are affiliated with this tracker; all game assets and data remain property of Grinding Gear Games.

## License

[MIT](./LICENSE) — same as Path of Building Community.
