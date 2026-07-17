import { describe, expect, it } from "vitest";
import { tokenizeSql, type SqlToken } from "./sqlHighlight";

/** Tokens of a given type, in order. */
const of = (toks: SqlToken[], type: SqlToken["type"]) =>
  toks.filter((t) => t.type === type).map((t) => t.value);

/** The core invariant: tokens always reconstruct the exact input. */
const joined = (toks: SqlToken[]) => toks.map((t) => t.value).join("");

describe("tokenizeSql", () => {
  it("reconstructs the input exactly for every case", () => {
    for (const src of [
      "",
      "SELECT * FROM t",
      "a'b\"c`d-- x\n/* y */ 3.14e-2 'q''q'",
      "no_sql_here just words 123",
    ]) {
      expect(joined(tokenizeSql(src))).toBe(src);
    }
  });

  it("highlights keywords case-insensitively", () => {
    const t = tokenizeSql("select Id from Users where ID = 1");
    expect(of(t, "keyword")).toEqual(["select", "from", "where"]);
  });

  it("does not highlight identifiers that merely contain a keyword", () => {
    const t = tokenizeSql("SELECTED selection from_date");
    expect(of(t, "keyword")).toEqual([]);
  });

  it("does not split digits out of an identifier", () => {
    const t = tokenizeSql("col2 t1.value");
    expect(of(t, "number")).toEqual([]);
  });

  it("tokenizes single-quoted strings with doubled-quote escapes", () => {
    const t = tokenizeSql("WHERE name = 'it''s a test'");
    expect(of(t, "string")).toEqual(["'it''s a test'"]);
    expect(of(t, "keyword")).toEqual(["WHERE"]);
  });

  it("does not start a string from a quote inside a quoted identifier", () => {
    const t = tokenizeSql('SELECT "we\'re" FROM t');
    // The apostrophe is inside the double-quoted identifier, so no string
    // token leaks out and FROM is still recognized.
    expect(of(t, "string")).toEqual([]);
    expect(of(t, "keyword")).toEqual(["SELECT", "FROM"]);
  });

  it("handles line and block comments, including unterminated ones", () => {
    const line = tokenizeSql("SELECT 1 -- trailing note\nFROM t");
    expect(of(line, "comment")).toEqual(["-- trailing note"]);
    expect(of(line, "keyword")).toEqual(["SELECT", "FROM"]);

    const block = tokenizeSql("a /* multi\nline */ b");
    expect(of(block, "comment")).toEqual(["/* multi\nline */"]);

    const open = tokenizeSql("x /* never closed");
    expect(of(open, "comment")).toEqual(["/* never closed"]);
  });

  it("tokenizes numeric literals", () => {
    const t = tokenizeSql("VALUES (42, 3.14, .5, 1e10, 2.0E-3)");
    expect(of(t, "number")).toEqual(["42", "3.14", ".5", "1e10", "2.0E-3"]);
  });

  it("leaves operators and punctuation as plain text", () => {
    const t = tokenizeSql("a >= b");
    expect(of(t, "keyword")).toEqual([]);
    expect(joined(t)).toBe("a >= b");
  });
});
