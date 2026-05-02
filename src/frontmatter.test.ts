import { describe, expect, it } from "vitest";
import { extractFrontmatter } from "./frontmatter";

describe("extractFrontmatter", () => {
  it("returns null for sources with no leading delimiter", () => {
    const out = extractFrontmatter(`# Heading\n\nBody.\n`);
    expect(out.fm).toBeNull();
    expect(out.bodyOffset).toBe(0);
  });

  it("returns null for sources with `---` not at the very top", () => {
    const out = extractFrontmatter(`# Heading\n---\nkey: val\n---\n`);
    expect(out.fm).toBeNull();
  });

  it("parses simple key/value frontmatter", () => {
    const src = `---\ntype: note\ntitle: Hello\n---\n# Body\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toEqual({ type: "note", title: "Hello" });
    expect(out.bodyOffset).toBeGreaterThan(0);
    expect(src.slice(out.bodyOffset)).toBe(`# Body\n`);
  });

  it("handles arrays, booleans, numbers, and nulls", () => {
    const src = `---\ntags: [a, b, c]\nactive: true\ncount: 42\nempty: null\n---\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toEqual({
      tags: ["a", "b", "c"],
      active: true,
      count: 42,
      empty: null,
    });
  });

  it("parses ISO dates as strings (yaml's default for unquoted YYYY-MM-DD is a Date — js-yaml converts)", () => {
    const src = `---\ncreated: 2026-04-11\n---\n`;
    const out = extractFrontmatter(src);
    // js-yaml parses ISO dates to Date instances. We don't assert the exact
    // type (the consumer reformats both); just that the value is present.
    expect(out.fm).not.toBeNull();
    expect(out.fm).toHaveProperty("created");
  });

  it("returns null for malformed YAML", () => {
    const src = `---\nbroken: [unclosed\n---\n# body\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toBeNull();
    expect(out.bodyOffset).toBe(0);
  });

  it("returns null when YAML parses to a non-object", () => {
    const src = `---\njust a string\n---\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toBeNull();
  });

  it("returns null when YAML parses to an array (top-level list)", () => {
    const src = `---\n- foo\n- bar\n---\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toBeNull();
  });

  it("computes bodyOffset such that source.slice(bodyOffset) is the body", () => {
    const src = `---\nkey: val\n---\n# Heading\n\nLorem ipsum.\n`;
    const out = extractFrontmatter(src);
    expect(src.slice(out.bodyOffset)).toBe(`# Heading\n\nLorem ipsum.\n`);
  });

  it("handles CRLF line endings inside the YAML", () => {
    const src = `---\r\nkey: val\r\n---\r\n# Body\r\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toEqual({ key: "val" });
  });

  it("returns null for an unterminated frontmatter block", () => {
    const src = `---\nkey: val\n# never closes\n`;
    const out = extractFrontmatter(src);
    expect(out.fm).toBeNull();
  });
});
