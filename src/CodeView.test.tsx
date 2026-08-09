import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeView } from "./CodeView";

describe("CodeView", () => {
  it("renders plain text verbatim", () => {
    const { container } = render(
      <CodeView kind="text" source={"line one\nline two"} path="/a/notes.txt" />
    );
    const pre = container.querySelector("pre.code-view")!;
    expect(pre).not.toBeNull();
    expect(pre.textContent).toBe("line one\nline two");
    // Plain text follows the app theme; highlighted code gets the dark panel.
    expect(pre.classList.contains("code-view-sql")).toBe(false);
  });

  it("syntax-highlights SQL keywords, strings, and comments", () => {
    const { container } = render(
      <CodeView
        kind="sql"
        source={"SELECT id FROM users -- note\nWHERE name = 'x'"}
        path="/q/q.sql"
      />
    );
    // SQL renders in the always-dark editor panel.
    expect(
      container.querySelector("pre.code-view.code-view-sql")
    ).not.toBeNull();
    const kws = Array.from(container.querySelectorAll(".tok-keyword")).map(
      (e) => e.textContent
    );
    expect(kws).toEqual(["SELECT", "FROM", "WHERE"]);
    expect(container.querySelector(".tok-comment")?.textContent).toBe(
      "-- note"
    );
    expect(container.querySelector(".tok-string")?.textContent).toBe("'x'");
    // Full text is preserved for searching / copy.
    expect(container.querySelector("pre.code-view")!.textContent).toBe(
      "SELECT id FROM users -- note\nWHERE name = 'x'"
    );
  });

  it("syntax-highlights YAML keys, values, and comments", () => {
    const { container } = render(
      <CodeView
        kind="yaml"
        source={"# config\nname: wyde\nport: 8080\nenabled: true"}
        path="/c/config.yaml"
      />
    );
    // YAML shares the always-dark editor panel with SQL.
    expect(
      container.querySelector("pre.code-view.code-view-yaml")
    ).not.toBeNull();
    const keys = Array.from(container.querySelectorAll(".tok-key")).map(
      (e) => e.textContent
    );
    expect(keys).toEqual(["name", "port", "enabled"]);
    expect(container.querySelector(".tok-comment")?.textContent).toBe(
      "# config"
    );
    expect(container.querySelector(".tok-number")?.textContent).toBe("8080");
    expect(container.querySelector(".tok-boolean")?.textContent).toBe("true");
    // Full text is preserved for searching / copy.
    expect(container.querySelector("pre.code-view")!.textContent).toBe(
      "# config\nname: wyde\nport: 8080\nenabled: true"
    );
  });

  it("shows a placeholder for binary files, naming the file", () => {
    render(<CodeView kind="binary" source="" path="/a/b/logo.png" />);
    expect(screen.getByText(/can’t display/i)).toBeInTheDocument();
    expect(screen.getByText(/logo\.png/)).toBeInTheDocument();
  });
});
