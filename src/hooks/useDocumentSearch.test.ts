import { describe, expect, it } from "vitest";
import { findRangesInContainer } from "./useDocumentSearch";

function makeContainer(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe("findRangesInContainer", () => {
  it("returns no ranges for an empty query", () => {
    const c = makeContainer("<p>hello world</p>");
    expect(findRangesInContainer(c, "")).toEqual([]);
  });

  it("finds multiple case-insensitive matches in one text node", () => {
    const c = makeContainer("<p>Foo foo fOO</p>");
    const ranges = findRangesInContainer(c, "foo");
    expect(ranges).toHaveLength(3);
    for (const r of ranges) expect(r.toString().toLowerCase()).toBe("foo");
  });

  it("finds matches across separate text nodes", () => {
    const c = makeContainer(
      "<p>alpha</p><p><strong>al</strong>pha beta</p>"
    );
    // 'alpha' in para 1 matches; 'alpha' in para 2 is split across two text
    // nodes (in <strong> then bare), so it should NOT match — search operates
    // on per-text-node strings. This is the documented v1 limitation.
    const ranges = findRangesInContainer(c, "alpha");
    expect(ranges).toHaveLength(1);
    expect(ranges[0].toString()).toBe("alpha");
  });

  it("skips text inside .mermaid-block", () => {
    const c = makeContainer(
      "<p>visible foo</p><div class='mermaid-block'><span>hidden foo</span></div>"
    );
    const ranges = findRangesInContainer(c, "foo");
    expect(ranges).toHaveLength(1);
  });

  it("skips text inside .search-bar so the input doesn't self-match", () => {
    const c = makeContainer(
      "<div class='search-bar'><span>foo</span></div><p>foo</p>"
    );
    const ranges = findRangesInContainer(c, "foo");
    expect(ranges).toHaveLength(1);
  });

  it("returns ranges with correct offsets", () => {
    const c = makeContainer("<p>abcXYZdef</p>");
    const ranges = findRangesInContainer(c, "xyz");
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startOffset).toBe(3);
    expect(ranges[0].endOffset).toBe(6);
    expect(ranges[0].toString()).toBe("XYZ");
  });

  it("handles overlapping-input correctly (advances past each match)", () => {
    // Searching "aa" in "aaaa" should yield 2 non-overlapping matches.
    const c = makeContainer("<p>aaaa</p>");
    const ranges = findRangesInContainer(c, "aa");
    expect(ranges).toHaveLength(2);
  });

  it("returns empty when nothing matches", () => {
    const c = makeContainer("<p>hello</p>");
    expect(findRangesInContainer(c, "zzz")).toEqual([]);
  });
});
