# wyde

A native macOS markdown viewer focused on **wide tables**: real `<table>`
elements with draggable column dividers and inline cell editing. Edits
write back surgically — only the changed cell touches disk; the rest of
the file stays byte-identical so `git diff` and external tools see no
churn.

The full design rationale (problem statement, surgical-write strategy,
phased plan) lives in [SPEC.md](./SPEC.md).

---

## Install (just want to use it)

You'll receive a `wyde.zip` from someone who built it. To install:

1. Unzip — you'll get `wyde.app`.
2. Drag `wyde.app` into `/Applications`.
3. **First launch must be right-click → Open**, not double-click.
   macOS will say "wyde cannot be opened because Apple cannot check it
   for malicious software" and offer an **Open** button — click it.
   This is because the build is unsigned (no Apple Developer
   certificate). After this first launch the warning never reappears
   and you can launch normally from the dock or Spotlight.

> **Power-user alternative:** if right-click → Open is awkward, run
> `xattr -dr com.apple.quarantine /Applications/wyde.app` in Terminal
> once after copying the app. Same effect, no Gatekeeper dialog.

### Use

- Drag a folder onto the window, or **⌘O** to pick one.
- **⌘N** opens an empty new window — drop a different folder there for
  an Obsidian-style multi-vault setup.
- Click any cell to edit, **Enter** or blur saves, **Esc** cancels.
- External edits to the open file refresh the view automatically
  (deferred while a cell is in edit mode).

---

## Build & share

If you have the toolchain, you can build the app and send it to others:

```bash
npm install
npm run dist
```

This produces `releases/wyde.zip` at the repo root. Send that file to
anyone with a Mac (Apple Silicon or Intel matching your build); they
follow the **Install** instructions above.

The first `npm run dist` after a fresh checkout downloads and compiles
~370 Rust crates and takes a few minutes. Subsequent runs are seconds.

The zipped `.app` is the same binary `tauri build` produces under
`src-tauri/target/release/bundle/macos/`; if you'd rather zip it
yourself, that's the path.

---

## Develop

Prerequisites:

- Node 20+ (see [`.nvmrc`](./.nvmrc))
- Rust toolchain — install via [rustup](https://rustup.rs)

```bash
npm install
npm run dev          # boots Tauri dev (Vite + cargo run)
```

Edits to `src/` hot-reload via Vite; edits to `src-tauri/` trigger a
Rust rebuild.

### Project layout

```
src/                    React app
  App.tsx               Top-level component
  hooks/                Reusable effects (drag-drop, watcher, shortcuts, …)
  lib/                  Pure helpers (error formatting)
  Sidebar.tsx           File tree + resize handle
  ResizableTable.tsx    Column-resize wrapper for <table>
  EditableCell.tsx      Click-to-edit <td>
  markdown-edit.ts      Surgical AST cell replacement
  fs.ts                 Tauri filesystem adapter
  styles.css            All app styling
src-tauri/              Rust shell + tauri config
assets/                 Source assets (logo)
SPEC.md                 Design document
```

### Scripts

| script                | what it does                                       |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | start the Tauri dev process (vite + native shell)  |
| `npm run build`       | type-check and build the web bundle into `dist/`   |
| `npm run tauri build` | produce a standalone `.app`                        |
| `npm run dist`        | build the `.app` and zip it to `releases/wyde.zip` |
| `npm run lint`        | ESLint over `src/`                                 |
| `npm run format`      | Prettier write across the repo                     |
| `npm run typecheck`   | `tsc --noEmit`                                     |
