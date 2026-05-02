# Developing wyde

## Prerequisites

- **Node 20+** (see [`.nvmrc`](./.nvmrc))
- **Rust toolchain** — install via [rustup](https://rustup.rs)

## Quickstart

```bash
npm install
npm run dev
```

`npm run dev` boots Tauri's dev process: Vite serves the React app on
`http://localhost:5173`, and `cargo run` launches the native window
pointing at it.

The first launch downloads and compiles ~370 Rust crates and takes
several minutes. Subsequent launches are seconds.

Edits to `src/` hot-reload via Vite. Edits to `src-tauri/` trigger a
Rust rebuild.

## Scripts

| script              | what it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`       | start the Tauri dev process (Vite + native shell)           |
| `npm run build`     | type-check and build the web bundle into `dist/`            |
| `npm run tauri`     | passthrough for the Tauri CLI (`npm run tauri build`, etc.) |
| `npm run lint`      | ESLint over `src/`                                          |
| `npm run format`    | Prettier write across the repo                              |
| `npm run typecheck` | `tsc --noEmit`                                              |

For release-build commands (`npm run dist`, tag-driven CI), see
[RELEASING.md](./RELEASING.md).

## Project layout

```
src/                    React app
  App.tsx               Top-level component
  hooks/                Reusable effects (drag-drop, watcher, shortcuts, …)
  lib/                  Pure helpers (error formatting)
  Sidebar.tsx           File tree + resize handle
  ResizableTable.tsx    Column-resize wrapper for <table>
  EditableCell.tsx      Click-to-edit <td>
  EditableBlock.tsx     Double-click-to-edit paragraphs / headings / list items
  Properties.tsx        YAML frontmatter "Properties" panel
  markdown-edit.ts      Surgical AST cell + block replacement
  frontmatter.ts        YAML frontmatter parser
  fs.ts                 Tauri filesystem adapter
  styles.css            All app styling
src-tauri/              Rust shell + Tauri config + capabilities
assets/                 Source assets (logo)
```

## Surgical-write architecture

Cell and block edits never re-serialize the whole document. Instead:

1. The mdast parser preserves byte offsets (`position.start.offset` /
   `position.end.offset`) for every node, including table cells and
   block-level elements.
2. `applyCellEdit` (cells) and `applyBlockEdit` (paragraphs / list
   items / ATX headings) splice the new content into exactly that byte
   range.
3. Everything outside the edited range is byte-identical to the
   original source. `git diff` shows only the line(s) the user
   actually changed.

This keeps the file format pure markdown — no editor-injected
whitespace padding, no reformatting on save, no fights with other
tools editing the same file.

## Tauri-specific notes

- **fs scope** is set to `**` in
  [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json).
  Single-user local app; the user is opening their own files. Tighten
  if redistributing.
- **Multi-window** uses `WebviewWindow` from `@tauri-apps/api`. Each
  window is an independent React tree (independent folder, file list,
  watcher state).
- **File watcher** uses `@tauri-apps/plugin-fs`'s `watch()` with a
  50 ms debounce. macOS fires multiple events per save; the debounce
  coalesces them.
- **External link clicks** intentionally `preventDefault` so the
  webview never navigates away. Cmd+click opens via
  `@tauri-apps/plugin-opener`.
