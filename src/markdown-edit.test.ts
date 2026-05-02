import { describe, expect, it } from "vitest";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Root, Table, TableCell } from "mdast";
import { visit } from "unist-util-visit";
import { applyBlockEdit, applyCellEdit, rawCellText } from "./markdown-edit";

/* ────────── helpers ────────── */

function parse(source: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(source) as Root;
}

/**
 * Walk the AST and return cell offsets `[start, end]` for the
 * (rowIndex, colIndex)-th cell of the n-th table. Throws if not found.
 */
function cellOffsets(
  source: string,
  rowIndex: number,
  colIndex: number,
  tableNth = 0
): { start: number; end: number } {
  let seen = -1;
  let result: { start: number; end: number } | null = null;
  visit(parse(source), "table", (table: Table) => {
    seen += 1;
    if (seen !== tableNth) return undefined;
    const row = table.children[rowIndex];
    const cell = row?.children[colIndex] as TableCell | undefined;
    if (!cell?.position) throw new Error("cell not found");
    result = {
      start: cell.position.start.offset!,
      end: cell.position.end.offset!,
    };
    return false; // stop visiting after target table
  });
  if (!result) throw new Error("table not found");
  return result;
}

/** Returns the start/end offsets of the n-th paragraph. */
function paragraphOffsets(
  source: string,
  nth = 0
): { start: number; end: number } {
  let seen = -1;
  let out: { start: number; end: number } | null = null;
  visit(parse(source), "paragraph", (node) => {
    seen += 1;
    if (seen !== nth) return undefined;
    out = {
      start: node.position!.start.offset!,
      end: node.position!.end.offset!,
    };
    return false;
  });
  if (!out) throw new Error("paragraph not found");
  return out;
}

function headingOffsets(
  source: string,
  nth = 0
): { start: number; end: number } {
  let seen = -1;
  let out: { start: number; end: number } | null = null;
  visit(parse(source), "heading", (node) => {
    seen += 1;
    if (seen !== nth) return undefined;
    out = {
      start: node.position!.start.offset!,
      end: node.position!.end.offset!,
    };
    return false;
  });
  if (!out) throw new Error("heading not found");
  return out;
}

function listItemOffsets(
  source: string,
  nth = 0
): { start: number; end: number } {
  let seen = -1;
  let out: { start: number; end: number } | null = null;
  visit(parse(source), "listItem", (node) => {
    seen += 1;
    if (seen !== nth) return undefined;
    out = {
      start: node.position!.start.offset!,
      end: node.position!.end.offset!,
    };
    return false;
  });
  if (!out) throw new Error("list item not found");
  return out;
}

const TABLE = `# Heading

| ID | Name |
| --- | --- |
| 001 | Ada |
| 002 | Alan |

After the table.
`;

/* ────────── applyCellEdit ────────── */

describe("applyCellEdit", () => {
  it("replaces a cell and leaves everything else byte-identical", () => {
    const { start } = cellOffsets(TABLE, 1, 1); // Ada
    const next = applyCellEdit(TABLE, start, "Ada Lovelace");
    expect(next).not.toBeNull();
    expect(next).toContain("| Ada Lovelace |");
    // Surrounding lines unchanged.
    expect(next).toContain("# Heading");
    expect(next).toContain("| 002 | Alan |");
    expect(next).toContain("After the table.");
  });

  it("escapes pipe characters in the new value as `\\|`", () => {
    const { start } = cellOffsets(TABLE, 1, 1);
    const next = applyCellEdit(TABLE, start, "a|b");
    expect(next).toContain("| a\\|b |");
  });

  it("flattens \\n and \\r\\n in the new value to spaces", () => {
    const { start } = cellOffsets(TABLE, 1, 1);
    expect(applyCellEdit(TABLE, start, "line1\nline2")).toContain(
      "| line1 line2 |"
    );
    expect(applyCellEdit(TABLE, start, "line1\r\nline2")).toContain(
      "| line1 line2 |"
    );
  });

  it("returns null when the offset doesn't match a cell", () => {
    expect(applyCellEdit(TABLE, 0, "x")).toBeNull(); // doc start, not a cell
  });

  it("preserves the rest of the table when editing a cell", () => {
    const { start } = cellOffsets(TABLE, 2, 0); // 002
    const next = applyCellEdit(TABLE, start, "099");
    expect(next).toContain("| 099 | Alan |");
    expect(next).toContain("| 001 | Ada |");
  });

  it("handles unicode (multi-byte) cell content", () => {
    const src = `| name |\n| --- |\n| 你好 |\n`;
    const { start } = cellOffsets(src, 1, 0);
    const next = applyCellEdit(src, start, "世界 🌏");
    expect(next).toBe(`| name |\n| --- |\n| 世界 🌏 |\n`);
  });

  it("handles tables without a leading pipe (GFM allows this)", () => {
    // Source with no leading pipe on data rows.
    const src = `name | val\n--- | ---\nfoo | 1\nbar | 2\n`;
    const { start } = cellOffsets(src, 1, 0);
    const next = applyCellEdit(src, start, "FOO");
    expect(next).toContain("FOO | 1");
    expect(next).toContain("bar | 2");
  });

  it("subsequent edits don't shift the table's start offset (stability)", () => {
    const before = parse(TABLE);
    let beforeStart = -1;
    visit(before, "table", (t) => {
      beforeStart = t.position!.start.offset!;
      return false;
    });
    const { start } = cellOffsets(TABLE, 1, 0);
    const after = applyCellEdit(TABLE, start, "a much longer ID")!;
    let afterStart = -1;
    visit(parse(after), "table", (t) => {
      afterStart = t.position!.start.offset!;
      return false;
    });
    expect(afterStart).toBe(beforeStart);
  });
});

/* ────────── applyBlockEdit ────────── */

describe("applyBlockEdit", () => {
  it("replaces a paragraph", () => {
    const src = `Hello world\n\nMore prose.\n`;
    const { start, end } = paragraphOffsets(src, 0);
    expect(applyBlockEdit(src, start, end, "Hi there")).toBe(
      `Hi there\n\nMore prose.\n`
    );
  });

  it("replaces an ATX heading", () => {
    const src = `# Title\n\nBody.\n`;
    const { start, end } = headingOffsets(src);
    expect(applyBlockEdit(src, start, end, "## Title v2")).toBe(
      `## Title v2\n\nBody.\n`
    );
  });

  it("replaces a list item", () => {
    const src = `- one\n- two\n- three\n`;
    const { start, end } = listItemOffsets(src, 1);
    expect(applyBlockEdit(src, start, end, "- TWO")).toBe(
      `- one\n- TWO\n- three\n`
    );
  });

  it("trims trailing newlines from the replacement", () => {
    const src = `Para A\n\nPara B\n`;
    const { start, end } = paragraphOffsets(src, 0);
    expect(applyBlockEdit(src, start, end, "Para A v2\n\n\n")).toBe(
      `Para A v2\n\nPara B\n`
    );
  });

  it("trims trailing CRLF newlines too", () => {
    const src = `Para\n`;
    const { start, end } = paragraphOffsets(src, 0);
    expect(applyBlockEdit(src, start, end, "Para v2\r\n\r\n")).toBe(
      `Para v2\n`
    );
  });

  it("returns input unchanged when replacement equals slice", () => {
    const src = `Hello world\n`;
    const { start, end } = paragraphOffsets(src, 0);
    expect(applyBlockEdit(src, start, end, "Hello world")).toBe(src);
  });
});

/* ────────── rawCellText ────────── */

describe("rawCellText", () => {
  it("strips bordering pipes and trims whitespace", () => {
    const src = `| name |\n| --- |\n| Ada |\n`;
    const { start, end } = cellOffsets(src, 1, 0);
    expect(rawCellText(src, start, end)).toBe("Ada");
  });

  it("unescapes \\| to |", () => {
    const src = `| col |\n| --- |\n| a\\|b |\n`;
    const { start, end } = cellOffsets(src, 1, 0);
    expect(rawCellText(src, start, end)).toBe("a|b");
  });

  it("handles trailing pipe with whitespace", () => {
    const src = `| a | b |\n| --- | --- |\n| 1 | 2 |\n`;
    const { start, end } = cellOffsets(src, 1, 1); // last cell of row
    expect(rawCellText(src, start, end)).toBe("2");
  });
});
