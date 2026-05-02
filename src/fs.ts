import {
  readDir,
  readTextFile,
  watch,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

export interface MarkdownFile {
  /** Path relative to the folder root, e.g. `notes/foo.md`. */
  name: string;
  /** Absolute path on disk. */
  path: string;
}

/** Directory names skipped during recursive scans. */
const SKIP_DIRS = new Set(["node_modules", "target", "dist", "build"]);

export async function readFile(absPath: string): Promise<string> {
  return readTextFile(absPath);
}

export async function writeFile(
  absPath: string,
  contents: string
): Promise<void> {
  await writeTextFile(absPath, contents);
}

/**
 * Recursively walk `absDir` and return every non-hidden `.md` file with
 * its name set to the path relative to `absDir`. POSIX-only path math —
 * intentional, since this app targets macOS.
 */
export async function listMarkdownFiles(
  absDir: string
): Promise<MarkdownFile[]> {
  const files: MarkdownFile[] = [];
  await walk(absDir, absDir, files);
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

async function walk(
  absDir: string,
  rootDir: string,
  out: MarkdownFile[]
): Promise<void> {
  let entries;
  try {
    entries = await readDir(absDir);
  } catch {
    // Unreadable subdirectory — skip without aborting the whole walk.
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childAbs = await join(absDir, e.name);
    if (e.isDirectory) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(childAbs, rootDir, out);
    } else if (e.isFile && e.name.endsWith(".md")) {
      const rel = childAbs.startsWith(rootDir + "/")
        ? childAbs.slice(rootDir.length + 1)
        : e.name;
      out.push({ name: rel, path: childAbs });
    }
  }
}

/**
 * Watch a single file. Tauri's plugin-fs fires multiple events per write on
 * macOS; the 50ms debounce coalesces them to a single callback per save.
 */
export async function watchPath(
  absPath: string,
  onEvent: () => void
): Promise<() => void> {
  const unwatch = await watch(absPath, () => onEvent(), { delayMs: 50 });
  return () => {
    void unwatch();
  };
}
