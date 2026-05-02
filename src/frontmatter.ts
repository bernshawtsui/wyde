import yaml from "js-yaml";

export type FrontmatterValue =
  | string
  | number
  | boolean
  | null
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export type Frontmatter = Record<string, FrontmatterValue>;

interface ExtractResult {
  /** Parsed YAML object, or `null` if the file has no recognizable frontmatter. */
  fm: Frontmatter | null;
  /**
   * Byte offset in the original source where the body (post-frontmatter)
   * starts. Equal to 0 when there's no frontmatter. Useful for callers that
   * want to display the body separately from the frontmatter without
   * disturbing AST offsets.
   */
  bodyOffset: number;
}

const FRONTMATTER_DELIMITER = /^---\r?\n/;
const FRONTMATTER_END = /\r?\n---\r?\n?/;

/**
 * Extract leading YAML frontmatter from a markdown source string.
 *
 * Recognizes the standard `---\n…\n---\n` delimiter pair at offset 0. Any
 * YAML parse error or shape that isn't an object is treated as "no
 * frontmatter" — callers see `{ fm: null, bodyOffset: 0 }` and render the
 * source as ordinary markdown.
 */
export function extractFrontmatter(source: string): ExtractResult {
  if (!FRONTMATTER_DELIMITER.test(source)) return { fm: null, bodyOffset: 0 };

  const after = source.replace(FRONTMATTER_DELIMITER, "");
  const startOfBody = source.length - after.length;
  const endMatch = after.match(FRONTMATTER_END);
  if (!endMatch || endMatch.index === undefined) {
    return { fm: null, bodyOffset: 0 };
  }

  const yamlText = after.slice(0, endMatch.index);
  const bodyOffset = startOfBody + endMatch.index + endMatch[0].length;

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch {
    return { fm: null, bodyOffset: 0 };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { fm: null, bodyOffset: 0 };
  }

  return { fm: parsed as Frontmatter, bodyOffset };
}
