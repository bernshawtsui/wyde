# Developing wyde

## Prerequisites

- **Node 20+** (see [`.nvmrc`](./.nvmrc))
- **pnpm 9+** — install via `corepack enable && corepack prepare pnpm@9 --activate`,
  or `npm install -g pnpm` if you prefer
- **Rust toolchain** — install via [rustup](https://rustup.rs)

## Quickstart

```bash
pnpm install
pnpm dev
```

`pnpm dev` boots Tauri's dev process: Vite serves the React app on
`http://localhost:5173`, and `cargo run` launches the native window
pointing at it.

The first launch downloads and compiles ~370 Rust crates and takes
several minutes. Subsequent launches are seconds.

Edits to `src/` hot-reload via Vite. Edits to `src-tauri/` trigger a
Rust rebuild.

## Scripts

| script           | what it does                                      |
| ---------------- | ------------------------------------------------- |
| `pnpm dev`       | start the Tauri dev process (Vite + native shell) |
| `pnpm build`     | type-check and build the web bundle into `dist/`  |
| `pnpm tauri …`   | passthrough to the Tauri CLI (`pnpm tauri build`) |
| `pnpm lint`      | ESLint over `src/`                                |
| `pnpm format`    | Prettier write across the repo                    |
| `pnpm typecheck` | `tsc --noEmit`                                    |

For release-build commands (`pnpm dist`, tag-driven CI), see
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
  MermaidBlock.tsx      Renders ```mermaid``` fenced blocks as SVG diagrams
  Properties.tsx        YAML frontmatter "Properties" panel
  markdown-edit.ts      Surgical AST cell + block replacement
  frontmatter.ts        YAML frontmatter parser
  fs.ts                 Tauri filesystem adapter
  styles.css            All app styling
src-tauri/              Rust shell + Tauri config + capabilities
assets/                 Source assets (logo)
```

## Testing

The repo uses **Vitest** + **React Testing Library** + **happy-dom**.
Tests live next to the code they cover, named `*.test.ts(x)`.

```bash
pnpm test          # one-shot run
pnpm test:watch    # re-run on save
pnpm test:coverage # text + HTML coverage report
```

### What's covered

- **Pure functions** — `markdown-edit.ts` (surgical-write contract:
  cell escaping, splice byte-stability, block edits, etc.),
  `frontmatter.ts` (YAML parse / malformed input handling),
  `lib/error.ts`.
- **Components without Tauri deps** — `Sidebar`, `Properties`,
  `ResizableTable` (drag pipeline incl. commit-on-drop),
  `EditableCell`, `EditableBlock` (ATX guard, sublist guard,
  Cmd+Enter behavior), `TabBar`.
- **Pure hooks** — `useZoom`, `useGlobalShortcuts`.

### What's NOT covered (intentional)

- **Tauri-dependent hooks**: `useFileWatcher`, `useFolderFiles`,
  `useDragDropFolder`. They wrap `@tauri-apps/plugin-fs` /
  `@tauri-apps/api/webview`. Mocking those would test our mocks; real
  coverage needs an E2E setup (`tauri-driver` + WebDriver) which is
  out of scope here.
- **`fs.ts`** — same reason; it's an adapter.
- **`App.tsx` and `TabContent.tsx`** — they pull in the Tauri APIs
  through hooks. The pieces they orchestrate are individually tested.
- **Rust shell** — five lines of plugin registration; nothing to
  test.

### Adding new tests

- Co-locate as `*.test.ts(x)` next to the source file.
- For pure functions: just import and assert.
- For components: render with `@testing-library/react`, drive with
  `@testing-library/user-event`, assert on observable behavior (text,
  attributes, callback invocations) — never on internal state.
- For hooks: `renderHook` from `@testing-library/react`, dispatch
  events on `window`, read `result.current`.
- If a component depends on a Tauri API, prefer to test the
  Tauri-free helper underneath. If you must mock, use `vi.mock` on
  the import boundary.

### CI

Two workflows run on every push:

- `.github/workflows/ci.yml` — typecheck + lint + tests on
  `ubuntu-latest`. Runs on push to `main` and on PRs.
- `.github/workflows/release.yml` — runs the same three checks
  before `tauri build` so a regression fails fast (~30 s) instead of
  surfacing after the slow Rust compile.

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

## Why pnpm

Earlier the project used `npm`, but the GitHub Actions macOS runners
shipped with two consecutive broken npm versions (silent-failure
[#7672](https://github.com/npm/cli/issues/7672) on Node 20, and a
corrupt bundled npm on Node 22). pnpm has its own resolver/installer
and isn't affected; tauri-action auto-detects pnpm from
`pnpm-lock.yaml`.
