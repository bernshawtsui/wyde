import {
  readDir,
  readFile as readBytes,
  watch,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { decodeTextFile, type DecodedFile } from "./lib/fileType";

export interface FileEntry {
  /** Path relative to the folder root, e.g. `notes/foo.md`. */
  name: string;
  /** Absolute path on disk. */
  path: string;
}

/** Directory names skipped during recursive scans. */
const SKIP_DIRS = new Set(["node_modules", "target", "dist", "build"]);

/**
 * Read a file and classify it as text or binary. Reads raw bytes (rather than
 * assuming UTF-8) so binary files degrade to a placeholder instead of throwing
 * — see {@link decodeTextFile}.
 */
export async function loadFile(absPath: string): Promise<DecodedFile> {
  const bytes = await readBytes(absPath);
  return decodeTextFile(bytes);
}

export async function writeFile(
  absPath: string,
  contents: string
): Promise<void> {
  await writeTextFile(absPath, contents);
}

/**
 * Recursively walk `absDir` and return every non-hidden file with its `name`
 * set to the path relative to `absDir`. All file types are listed; how each is
 * rendered (markdown, SQL, plain text, or a binary placeholder) is decided at
 * open time. POSIX-only path math — intentional, since this app targets macOS.
 */
export async function listFiles(absDir: string): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  await walk(absDir, absDir, files);
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

async function walk(
  absDir: string,
  rootDir: string,
  out: FileEntry[]
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
    } else if (e.isFile) {
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

/**
 * Watch a directory recursively. Larger debounce than `watchPath` because
 * folder-level events come in storms (e.g. `git checkout` touches many files
 * at once) and we want one rescan, not many.
 */
export async function watchFolder(
  absDir: string,
  onEvent: () => void
): Promise<() => void> {
  const unwatch = await watch(absDir, () => onEvent(), {
    recursive: true,
    delayMs: 300,
  });
  return () => {
    void unwatch();
  };
}
