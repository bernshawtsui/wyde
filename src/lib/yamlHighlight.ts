/**
 * A small, dependency-free YAML tokenizer for read-only syntax highlighting.
 *
 * YAML is line-oriented, so this scans line by line rather than free-form like
 * {@link ./sqlHighlight}. It is deliberately lenient: the worst failure mode
 * for a viewer is a token wearing the wrong color, never a crash or lost text.
 * The concatenation of every token's `value` always equals the input exactly,
 * so the rendered view is byte-for-byte the source.
 *
 * Highlighted: mapping keys, quoted strings, numbers, booleans/null, and
 * comments. Unquoted scalars stay plain (that's the common editor convention
 * and keeps config files calm), as do anchors, aliases, and tags.
 */

export type YamlTokenType =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "comment"
  | "plain";

export interface YamlToken {
  type: YamlTokenType;
  value: string;
}

/** Values YAML treats as booleans or null. YAML 1.1 spelling included. */
const CONSTANTS = new Set([
  "true",
  "false",
  "yes",
  "no",
  "on",
  "off",
  "null",
  "~",
]);

/** Characters that can appear in an unquoted scalar word. */
const WORD_CHAR = /[A-Za-z0-9_.~+-]/;

/** Block scalar header: `|`/`>` plus optional chomping/indent indicators. */
const BLOCK_SCALAR = /^([|>][+-]?\d*[+-]?)([ \t]*)(#.*)?$/;

function isNumeric(word: string): boolean {
  if (/^[-+]?0x[0-9a-fA-F]+$/.test(word)) return true;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(word);
}

/**
 * Index just past the closing quote of the quoted run starting at `i`.
 * Handles `\"` escapes in double quotes and `''` escapes in single quotes.
 * An unterminated quote runs to end of line.
 */
function skipQuoted(line: string, i: number, quote: string): number {
  let j = i + 1;
  while (j < line.length) {
    if (quote === '"' && line[j] === "\\") {
      j += 2;
      continue;
    }
    if (line[j] === quote) {
      // `''` inside a single-quoted scalar is a literal quote, not the end.
      if (quote === "'" && line[j + 1] === "'") {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j++;
  }
  return line.length;
}

/**
 * Index of the `:` that separates a mapping key from its value, or -1 when
 * this line has no key. Only a colon at end-of-line or followed by whitespace
 * counts, so `url: http://x` finds the first colon and not the one in the URL.
 */
function findKeyColon(line: string, start: number): number {
  let i = start;
  while (i < line.length) {
    const c = line[i];
    if (c === '"' || c === "'") {
      i = skipQuoted(line, i, c);
      continue;
    }
    // A comment ends the search. Anything after it isn't a key.
    if (c === "#" && i > start && /\s/.test(line[i - 1])) return -1;
    if (c === ":") {
      const next = line[i + 1];
      if (next === undefined || next === " " || next === "\t") return i;
    }
    i++;
  }
  return -1;
}

export function tokenizeYaml(src: string): YamlToken[] {
  const out: YamlToken[] = [];

  /** Append a token, merging consecutive `plain` runs to keep output compact. */
  const push = (type: YamlTokenType, value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (type === "plain" && last?.type === "plain") {
      last.value += value;
      return;
    }
    out.push({ type, value });
  };

  /**
   * Tokenize the value side of a line (everything after any `key:`), emitting
   * strings, numbers, booleans, and a trailing comment.
   */
  const scanValue = (line: string, start: number) => {
    let i = start;
    let plainStart = i;
    const flushPlain = (end: number) => {
      if (end > plainStart) push("plain", line.slice(plainStart, end));
    };

    while (i < line.length) {
      const c = line[i];

      // `#` starts a comment only at the start of the value or after a space.
      if (c === "#" && (i === start || /\s/.test(line[i - 1]))) {
        flushPlain(i);
        push("comment", line.slice(i));
        return;
      }

      if (c === '"' || c === "'") {
        flushPlain(i);
        const end = skipQuoted(line, i, c);
        push("string", line.slice(i, end));
        i = end;
        plainStart = i;
        continue;
      }

      // Word runs are checked for numbers / booleans. Only start one at a
      // boundary so the digits inside `v1.2-beta` aren't picked out.
      const prev = i > 0 ? line[i - 1] : "";
      if (WORD_CHAR.test(c) && !WORD_CHAR.test(prev)) {
        let j = i;
        while (j < line.length && WORD_CHAR.test(line[j])) j++;
        const word = line.slice(i, j);
        if (isNumeric(word)) {
          flushPlain(i);
          push("number", word);
        } else if (CONSTANTS.has(word.toLowerCase())) {
          flushPlain(i);
          push("boolean", word);
        } else {
          i = j;
          continue; // ordinary unquoted scalar stays plain
        }
        i = j;
        plainStart = i;
        continue;
      }

      i++;
    }
    flushPlain(i);
  };

  const lines = src.split("\n");
  // Indent of the line that opened a `|` / `>` block, or null when not inside
  // one. Content indented deeper than that line is literal text.
  let blockScalarIndent: number | null = null;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (li > 0) push("plain", "\n");

    const trimmedStart = line.length - line.trimStart().length;
    const isBlank = line.trim() === "";

    // Inside a block scalar: emit deeper-indented (and blank) lines verbatim.
    if (blockScalarIndent !== null) {
      if (isBlank || trimmedStart > blockScalarIndent) {
        push("plain", line);
        continue;
      }
      blockScalarIndent = null; // dedented, back to normal parsing
    }

    if (isBlank) {
      push("plain", line);
      continue;
    }

    let i = trimmedStart;
    push("plain", line.slice(0, i));
    const lineIndent = i;

    // Document markers (`---`, `...`) are structural punctuation.
    const rest = line.slice(i);
    if (/^(---|\.\.\.)(\s|$)/.test(rest)) {
      push("plain", line.slice(i, i + 3));
      i += 3;
    } else {
      if (line[i] === "#") {
        push("comment", line.slice(i));
        continue;
      }
      // Sequence markers: one or more `- ` prefixes.
      while (line[i] === "-" && (i + 1 >= line.length || line[i + 1] === " ")) {
        const from = i;
        i++;
        while (i < line.length && line[i] === " ") i++;
        push("plain", line.slice(from, i));
      }
      if (i >= line.length) continue;
      if (line[i] === "#") {
        push("comment", line.slice(i));
        continue;
      }
      const colon = findKeyColon(line, i);
      if (colon >= 0) {
        push("key", line.slice(i, colon));
        push("plain", ":");
        i = colon + 1;
      }
    }

    // A `|` / `>` header opens a literal block; remember this line's indent.
    let k = i;
    while (k < line.length && (line[k] === " " || line[k] === "\t")) k++;
    const header = line.slice(k).match(BLOCK_SCALAR);
    if (header) {
      push("plain", line.slice(i, k) + header[1] + header[2]);
      if (header[3]) push("comment", header[3]);
      blockScalarIndent = lineIndent;
      continue;
    }

    scanValue(line, i);
  }

  return out;
}
