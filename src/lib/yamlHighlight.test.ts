import { describe, expect, it } from "vitest";
import { tokenizeYaml, type YamlToken } from "./yamlHighlight";

/** Tokens of a given type, in order. */
const of = (toks: YamlToken[], type: YamlToken["type"]) =>
  toks.filter((t) => t.type === type).map((t) => t.value);

/** The core invariant: tokens always reconstruct the exact input. */
const joined = (toks: YamlToken[]) => toks.map((t) => t.value).join("");

describe("tokenizeYaml", () => {
  it("reconstructs the input exactly for every case", () => {
    for (const src of [
      "",
      "\n",
      "name: wyde",
      "# just a comment",
      "a: 1\nb: 'two'\n\nc:\n  - x\n  - y\n",
      "url: http://example.com/#frag\nweird: [1, {a: b}]",
      "block: |\n  literal # not a comment\n  key: not a key\nafter: 1",
      "  \t  \nragged:   \t\n",
    ]) {
      expect(joined(tokenizeYaml(src))).toBe(src);
    }
  });

  it("highlights mapping keys but not the value", () => {
    const t = tokenizeYaml("name: wyde\nversion: 1.1.0");
    expect(of(t, "key")).toEqual(["name", "version"]);
    // Unquoted scalars stay plain; `1.1.0` is not a number.
    expect(of(t, "number")).toEqual([]);
  });

  it("keeps nested and sequence keys highlighted", () => {
    const t = tokenizeYaml("nested:\n  timeout: 30\n  - item: a");
    expect(of(t, "key")).toEqual(["nested", "timeout", "item"]);
  });

  it("does not treat a URL's colon as a key separator", () => {
    const t = tokenizeYaml("url: http://example.com:8080/path");
    // Only `url` is the key. The colons inside the URL are not separators.
    expect(of(t, "key")).toEqual(["url"]);
  });

  it("tokenizes quoted strings, including embedded escapes", () => {
    const t = tokenizeYaml("a: \"he said \\\"hi\\\"\"\nb: 'it''s fine'");
    expect(of(t, "string")).toEqual(['"he said \\"hi\\""', "'it''s fine'"]);
    expect(of(t, "key")).toEqual(["a", "b"]);
  });

  it("highlights a quoted key as a key", () => {
    const t = tokenizeYaml('"my key": value');
    expect(of(t, "key")).toEqual(['"my key"']);
  });

  it("tokenizes numbers and booleans", () => {
    const t = tokenizeYaml(
      "port: 8080\nratio: 1.5\nsci: 2e10\nhex: 0x1f\nok: true\nnope: false\nempty: null\ntilde: ~"
    );
    expect(of(t, "number")).toEqual(["8080", "1.5", "2e10", "0x1f"]);
    expect(of(t, "boolean")).toEqual(["true", "false", "null", "~"]);
  });

  it("handles full-line and trailing comments", () => {
    const t = tokenizeYaml("# header\nport: 8080 # the port\n  # indented");
    expect(of(t, "comment")).toEqual(["# header", "# the port", "# indented"]);
    expect(of(t, "number")).toEqual(["8080"]);
  });

  it("does not treat a `#` without leading space as a comment", () => {
    const t = tokenizeYaml("url: http://example.com/#frag");
    expect(of(t, "comment")).toEqual([]);
  });

  it("leaves block scalar content literal", () => {
    const src = [
      "script: |",
      "  echo # not a comment",
      "  key: not a key",
      "",
      "next: 1",
    ].join("\n");
    const t = tokenizeYaml(src);
    // Only the real keys outside the block are highlighted.
    expect(of(t, "key")).toEqual(["script", "next"]);
    // Nothing inside the block became a comment.
    expect(of(t, "comment")).toEqual([]);
    expect(joined(t)).toBe(src);
  });

  it("keeps a comment on the block scalar header line", () => {
    const t = tokenizeYaml("script: |- # trailing\n  body\n");
    expect(of(t, "comment")).toEqual(["# trailing"]);
    expect(of(t, "key")).toEqual(["script"]);
  });

  it("treats document markers as plain structure", () => {
    const t = tokenizeYaml("---\na: 1\n...\n");
    expect(of(t, "key")).toEqual(["a"]);
    expect(joined(t)).toBe("---\na: 1\n...\n");
  });

  it("highlights inside flow collections", () => {
    const t = tokenizeYaml("list: [1, 'two', true]");
    expect(of(t, "number")).toEqual(["1"]);
    expect(of(t, "string")).toEqual(["'two'"]);
    expect(of(t, "boolean")).toEqual(["true"]);
  });

  it("handles a realistic config end to end", () => {
    const src = [
      "# CI pipeline",
      "name: release",
      "on:",
      "  push:",
      "    tags:",
      '      - "v*"',
      "jobs:",
      "  build:",
      "    runs-on: macos-latest",
      "    timeout-minutes: 45",
      "    env:",
      "      CACHE: true",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - name: Build",
      "        run: |",
      "          pnpm install # inside a block, not a comment",
      "          pnpm build",
      "        shell: bash",
    ].join("\n");
    const t = tokenizeYaml(src);
    expect(joined(t)).toBe(src);
    expect(of(t, "key")).toEqual([
      "name",
      "on",
      "push",
      "tags",
      "jobs",
      "build",
      "runs-on",
      "timeout-minutes",
      "env",
      "CACHE",
      "steps",
      "uses",
      "name",
      "run",
      "shell",
    ]);
    // The `#` inside the block scalar stays literal.
    expect(of(t, "comment")).toEqual(["# CI pipeline"]);
    expect(of(t, "number")).toEqual(["45"]);
    expect(of(t, "boolean")).toEqual(["true"]);
    expect(of(t, "string")).toEqual(['"v*"']);
  });

  it("does not pick digits out of an unquoted scalar", () => {
    const t = tokenizeYaml("image: nginx:1.21-alpine\ndur: 30s");
    expect(of(t, "number")).toEqual([]);
  });
});
