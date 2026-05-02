# wyde

A native macOS markdown viewer focused on **wide tables**: real `<table>`
elements with draggable column dividers and inline cell editing. Edits
write back surgically — only the changed cell touches disk; the rest of
the file stays byte-identical so `git diff` and external tools see no
churn.

## Why I built this

In my current job, we are all-in AI, and we've been working a lot with
Andrej Karpathy's idea of LLM-managed knowledge base. As a result, we
have a lot of AI-generated files in markdown — schema definitions, ETL
mappings, comparison matrices, decision logs — and the moment a table
gets more than four or five columns, every markdown editor I've tried
becomes painful to use. Obsidian, Typora, VS Code, Mark Text — they
all treat tables like punishment.

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

## Install

Grab `wyde_*_universal.dmg` from the latest
[release](https://github.com/bernshawtsui/wyde/releases). One `.dmg`
works on Apple Silicon and Intel Macs.

1. Open the `.dmg` and drag **wyde** into `/Applications`.
2. **First launch must be right-click → Open**, not double-click.
   macOS will say "wyde cannot be opened because Apple cannot check
   it for malicious software" and offer an **Open** button — click
   it. This is because the build is unsigned (no Apple Developer
   certificate). After this first launch the warning never reappears
   and you can launch normally from the dock or Spotlight.

> **Power-user alternative:** if right-click → Open is awkward, run
> `xattr -dr com.apple.quarantine /Applications/wyde.app` in Terminal
> once after copying the app. Same effect, no Gatekeeper dialog.

## Use

- Drag a folder onto the window, or **⌘O** to pick one.
- **⌘N** opens an empty new window — drop a different folder there
  for an Obsidian-style multi-vault setup.
- **⌘B** toggles the sidebar.
- **⌘+** / **⌘-** / **⌘0** zoom in / out / reset.
- Click a cell to edit; double-click a paragraph or heading. **Enter**
  or blur saves, **Esc** cancels.
- **⌘+click** a link to open it in your default browser.
- External edits to the open file refresh the view automatically
  (deferred while you're editing a cell).

---

## Building from source

If you want to compile wyde yourself (Mac toolchain required), see
[DEVELOPING.md](./DEVELOPING.md).

Maintainer release procedure lives in [RELEASING.md](./RELEASING.md).
