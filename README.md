# wyde

A native macOS markdown viewer focused on **wide tables**: real `<table>`
elements with draggable column dividers and inline cell editing. Edits
write back surgically — only the changed cell touches disk; the rest of
the file stays byte-identical so `git diff` and external tools see no
churn.

## Why I built this

In my current job, we are all-in AI, and we’ve been working a lot with Andrej Karpathy’s idea of LLM-managed knowledge base. As a result, we have a lot of AI-generated files in markdown — schema definitions, ETL
mappings, comparison matrices, decision logs — and the moment a table
gets more than four or five columns, every markdown editor I've tried
becomes painful to use. Obsidian, Typora, VS Code, Mark Text — they all
treat tables like punishment.

The fundamental problem is that markdown's plain-text format has **no
concept of column width**. Editors deal with this in one of two
unhappy ways:

- _Ignore it._ The table renders with all columns squashed together;
  long content wraps awkwardly or gets cut off; you can't read what's
  in front of you.
- _Pad the source with whitespace_ to "fix" rendering. This produces
  noisy diffs, fights every other tool that touches the same file
  (Claude Code in particular keeps re-padding tables out from under
  you), and makes `git blame` useless.

wyde takes a third path: **column width is purely a session-only
display concern.** Drag a column wider, read your table comfortably,
close the file. The `.md` on disk never gets touched. Next time you
open it, columns reset to a sensible default — and the file stays pure
markdown that every other tool can read without surprise.

You also get **inline editing for cells, paragraphs, ATX headings, and
list items**. Click a cell or double-click a paragraph, type, blur to
save. The diff on disk shows only the edited block; everything else
stays byte-identical.

## Current limitations

- **macOS only.** Distributed as an unsigned `.app`, so Gatekeeper
  warns on first launch — see Install below for the right-click → Open
  workaround.
- **Read-only blocks.** Code blocks, blockquotes, horizontal rules,
  setext-style headings (`Title\n=====`), HTML blocks, and YAML
  frontmatter aren't editable inside the app. Edit them in your normal
  editor; the file watcher refreshes the view automatically.
- **GFM tables only.** No support for alignment beyond what GFM offers.
- **Column widths reset** on every file open. This is intentional — see
  above — but if it bites you, that's the trade-off you're choosing.
- **One folder per window** (Obsidian-style). No tabs, no multi-folder
  view inside a single window. ⌘N opens a new window for a different
  folder.
- **No code signing or auto-update.** Casual-share distribution; if you
  want notarization or in-app updates, that's a separate setup.
- **No prose WYSIWYG.** Editing prose means editing raw markdown source
  (so `**bold**` shows up in the textarea). If you'd rather see
  formatted text while editing, this isn't the tool.

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

Two paths depending on how formal you want to be.

### Option A — local zip, send by hand

If you have the toolchain, you can build and zip locally:

```bash
npm install
npm run dist
```

This produces `releases/wyde.zip` at the repo root. Send that file to
anyone with a Mac (matches your build's arch); they follow the
**Install** instructions above.

The first `npm run dist` after a fresh checkout downloads and compiles
~370 Rust crates and takes a few minutes. Subsequent runs are seconds.

### Option B — publish a GitHub release (Recommended)

GitHub Actions can build a **universal** `.dmg` (works on Apple Silicon
_and_ Intel) and attach it to a GitHub Release whenever you push a
version tag.

**One-time setup** (wires the local repo to GitHub):

```bash
git remote add origin https://github.com/bernshawtsui/wyde.git
git push -u origin main
```

**Cutting a release**:

1. Bump the version in **all three** of these files to the same number
   (e.g. `0.2.0`). Tauri-action verifies they match the tag:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Commit and push the version bump.
3. Tag and push the tag:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. The `release` workflow runs on `macos-latest` (~5–10 min). When it
   finishes, a **draft** release appears at
   `https://github.com/bernshawtsui/wyde/releases` with two assets
   attached:
   - `wyde_<version>_universal.dmg` — primary download
   - `wyde_<version>_universal.app.tar.gz` — alternative archive

5. Edit the release notes, click **Publish**. Recipients now follow
   the **Install** section at the top of this README.

The build uses `GITHUB_TOKEN` (auto-provided by Actions) so no secrets
need to be configured. Builds are unsigned — recipients still see the
"unidentified developer" warning the first time.

To rebuild without re-tagging (debugging, etc.) trigger the workflow
manually from the Actions tab (`workflow_dispatch`).

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
  EditableBlock.tsx     Double-click-to-edit paragraphs / headings / list items
  Properties.tsx        YAML frontmatter "Properties" panel
  markdown-edit.ts      Surgical AST cell + block replacement
  frontmatter.ts        YAML frontmatter parser
  fs.ts                 Tauri filesystem adapter
  styles.css            All app styling
src-tauri/              Rust shell + tauri config
assets/                 Source assets (logo)
```

### Scripts

| script                | what it does                                       |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | start the Tauri dev process (vite + native shell)  |
| `npm run build`       | type-check and build the web bundle into `dist/`   |
| `npm run tauri build` | produce a standalone `.app`                        |
| `npm run dist`        | build the `.app` and zip it to `releases/wyde.zip` |
| `git push origin v*`  | trigger CI release build (see Option B above)      |
| `npm run lint`        | ESLint over `src/`                                 |
| `npm run format`      | Prettier write across the repo                     |
| `npm run typecheck`   | `tsc --noEmit`                                     |
