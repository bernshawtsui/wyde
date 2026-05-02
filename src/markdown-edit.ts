import type { Root, Table, TableCell } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { EXIT, visit } from "unist-util-visit";

function parseMarkdown(source: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(source) as Root;
}

function unescapeCell(s: string): string {
  return s.replace(/\\\|/g, "|");
}

function escapeCell(s: string): string {
  // GFM table cells must escape `|`. Newlines in user input would break the
  // single-line cell layout, so flatten to spaces.
  return s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function stripBoundaryPipes(raw: string): string {
  return raw
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .trim();
}

/**
 * Extract the displayed text of a table cell from the source string given
 * its mdast position offsets. Strips the bordering `|` characters that
 * mdast includes in the cell range.
 */
export function rawCellText(
  source: string,
  startOffset: number,
  endOffset: number
): string {
  return unescapeCell(stripBoundaryPipes(source.slice(startOffset, endOffset)));
}

/**
 * Replace exactly one cell's content in the source string. The returned
 * string is byte-identical to the input outside the changed cell, so a
 * `git diff` on the saved file shows only the edit.
 *
 * `cellOffset` must be the `position.start.offset` of the targeted mdast
 * `tableCell`. Returns `null` if no such cell exists.
 */
export function applyCellEdit(
  source: string,
  cellOffset: number,
  newValue: string
): string | null {
  const tree = parseMarkdown(source);
  const cell = findCellByOffset(tree, cellOffset);
  if (!cell?.position) return null;

  const cellStart = cell.position.start.offset;
  const cellEnd = cell.position.end.offset;
  if (cellStart == null || cellEnd == null) return null;
  const slice = source.slice(cellStart, cellEnd);

  // mdast TableCell positions span from the leading `|` (or the start of
  // the first cell on a line) to the next `|` for non-terminal cells, or
  // through the trailing `|` for the last cell on a line. Replace only the
  // inner content so unedited cells stay byte-identical.
  const hasLeadingPipe = slice.startsWith("|");
  const hasTrailingPipe = slice.endsWith("|");
  const contentStart = cellStart + (hasLeadingPipe ? 1 : 0);
  const contentEnd = cellEnd - (hasTrailingPipe ? 1 : 0);

  const replacement = ` ${escapeCell(newValue)} `;
  return source.slice(0, contentStart) + replacement + source.slice(contentEnd);
}

/**
 * Replace a contiguous byte range with `newBlockSource`, returning the
 * resulting full-document string. Used for paragraph / heading / list-item
 * edits where the editor surface shows the raw markdown slice.
 *
 * Trailing newlines on `newBlockSource` are stripped so that the splice
 * preserves the existing inter-block newline rather than doubling it.
 */
export function applyBlockEdit(
  source: string,
  blockStartOffset: number,
  blockEndOffset: number,
  newBlockSource: string
): string {
  // Strip ALL trailing line endings (LF or CRLF, in any combination) so the
  // user's textarea content doesn't double-newline the source.
  const trimmed = newBlockSource.replace(/(\r?\n)+$/, "");
  return (
    source.slice(0, blockStartOffset) + trimmed + source.slice(blockEndOffset)
  );
}

function findCellByOffset(tree: Root, cellOffset: number): TableCell | null {
  let result: TableCell | null = null;
  visit(tree, "table", (table: Table) => {
    for (const row of table.children) {
      for (const cell of row.children) {
        if (cell.position?.start.offset === cellOffset) {
          result = cell;
          return EXIT;
        }
      }
    }
    return undefined;
  });
  return result;
}
