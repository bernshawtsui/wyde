import { describe, expect, it } from "vitest";
import { decodeTextFile, fileKindForPath } from "./fileType";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("fileKindForPath", () => {
  it("recognizes markdown extensions", () => {
    expect(fileKindForPath("/a/b/notes.md")).toBe("markdown");
    expect(fileKindForPath("README.markdown")).toBe("markdown");
    expect(fileKindForPath("/x/UPPER.MD")).toBe("markdown");
  });

  it("recognizes sql", () => {
    expect(fileKindForPath("/q/query.sql")).toBe("sql");
    expect(fileKindForPath("Query.SQL")).toBe("sql");
  });

  it("recognizes yaml", () => {
    expect(fileKindForPath("/c/config.yaml")).toBe("yaml");
    expect(fileKindForPath("docker-compose.yml")).toBe("yaml");
    expect(fileKindForPath("/c/CI.YML")).toBe("yaml");
  });

  it("treats everything else as plain text", () => {
    expect(fileKindForPath("/a/data.json")).toBe("text");
    expect(fileKindForPath("notes.txt")).toBe("text");
    expect(fileKindForPath("/a/Makefile")).toBe("text");
    expect(fileKindForPath("/a/logo.png")).toBe("text");
  });

  it("does not treat a hidden-file dot as an extension", () => {
    expect(fileKindForPath("/repo/.gitignore")).toBe("text");
  });
});

describe("decodeTextFile", () => {
  it("decodes valid UTF-8 as text", () => {
    const r = decodeTextFile(utf8("SELECT 1;\n-- café ☕\n"));
    expect(r.kind).toBe("text");
    if (r.kind === "text") expect(r.text).toBe("SELECT 1;\n-- café ☕\n");
  });

  it("flags a NUL byte as binary", () => {
    expect(decodeTextFile(new Uint8Array([0x48, 0x00, 0x49])).kind).toBe(
      "binary"
    );
  });

  it("flags invalid UTF-8 as binary", () => {
    // 0xff is never a valid UTF-8 lead byte.
    expect(decodeTextFile(new Uint8Array([0xff, 0xfe, 0x41])).kind).toBe(
      "binary"
    );
  });

  it("preserves a leading BOM as a literal character", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]); // BOM + "hi"
    const r = decodeTextFile(bytes);
    expect(r.kind).toBe("text");
    if (r.kind === "text") expect(r.text).toBe("\uFEFFhi");
  });

  it("treats an empty file as text", () => {
    const r = decodeTextFile(new Uint8Array([]));
    expect(r.kind).toBe("text");
    if (r.kind === "text") expect(r.text).toBe("");
  });
});
