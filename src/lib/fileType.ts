/**
 * File classification for the viewer. Extension decides how a *text* file is
 * rendered (markdown vs. syntax-highlighted vs. plain); whether a file is text
 * at all is decided from its bytes at load time — see {@link decodeTextFile}.
 */

/** How a text file is rendered. */
export type FileKind = "markdown" | "sql" | "text";

/** Effective kind of an open tab — a {@link FileKind}, or `binary` when the
 * file's bytes don't decode as UTF-8 text. */
export type TabKind = FileKind | "binary";

/**
 * Classify a path by its extension. Pure and case-insensitive. Anything that
 * isn't recognized markdown or SQL is treated as plain `text`; the binary case
 * is never decided here (it needs the bytes).
 */
export function fileKindForPath(path: string): FileKind {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  // A leading dot (e.g. `.gitignore`) is a hidden-file prefix, not an
  // extension separator — those files are already filtered out of the tree,
  // but treat them as plain text if one is opened directly.
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "sql") return "sql";
  return "text";
}

export type DecodedFile = { kind: "text"; text: string } | { kind: "binary" };

/** Bytes scanned for a NUL when sniffing for binary content. */
const BINARY_SNIFF_BYTES = 8000;

/**
 * Decide whether a file's raw bytes are displayable UTF-8 text, and if so
 * return the decoded string. Pure — no filesystem access.
 *
 * Two signals mark a file binary:
 *  1. A NUL byte near the start. Real text never contains one; most binary
 *     formats do.
 *  2. Any invalid UTF-8 sequence (`fatal` decoder throws).
 *
 * `ignoreBOM` keeps a leading byte-order mark as a literal U+FEFF character
 * so the in-memory string stays byte-identical to disk — wyde's surgical
 * writer relies on that for BOM-prefixed files.
 */
export function decodeTextFile(bytes: Uint8Array): DecodedFile {
  const scanLen = Math.min(bytes.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < scanLen; i++) {
    if (bytes[i] === 0) return { kind: "binary" };
  }
  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    return { kind: "text", text };
  } catch {
    return { kind: "binary" };
  }
}
