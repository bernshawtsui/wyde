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
    // Plain text follows the app theme; only SQL gets the dark panel.
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

  it("shows a placeholder for binary files, naming the file", () => {
    render(<CodeView kind="binary" source="" path="/a/b/logo.png" />);
    expect(screen.getByText(/can’t display/i)).toBeInTheDocument();
    expect(screen.getByText(/logo\.png/)).toBeInTheDocument();
  });
});
