import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import type { MarkdownFile } from "./fs";

const sample: MarkdownFile[] = [
  { name: "a.md", path: "/abs/a.md" },
  { name: "sub/b.md", path: "/abs/sub/b.md" },
  { name: "sub/sub2/c.md", path: "/abs/sub/sub2/c.md" },
  { name: "z.md", path: "/abs/z.md" },
];

describe("Sidebar", () => {
  it("renders an empty hint when there are no files", () => {
    render(<Sidebar files={[]} selectedPath={null} onSelect={() => {}} />);
    expect(screen.getByText(/no \.md files/i)).toBeInTheDocument();
  });

  it("builds a tree with directories above files at each level", async () => {
    const user = userEvent.setup();
    render(<Sidebar files={sample} selectedPath={null} onSelect={() => {}} />);
    // Top-level entries: directory `sub`, then files a.md, z.md.
    expect(screen.getByText("sub")).toBeInTheDocument();
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByText("z.md")).toBeInTheDocument();
    // Subfolders start collapsed; children appear only after expanding.
    expect(screen.queryByText("b.md")).not.toBeInTheDocument();
    expect(screen.queryByText("sub2")).not.toBeInTheDocument();
    await user.click(screen.getByText("sub"));
    expect(screen.getByText("b.md")).toBeInTheDocument();
    expect(screen.getByText("sub2")).toBeInTheDocument();
    await user.click(screen.getByText("sub2"));
    expect(screen.getByText("c.md")).toBeInTheDocument();
  });

  it("toggling a directory expands then re-collapses its children", async () => {
    const user = userEvent.setup();
    render(<Sidebar files={sample} selectedPath={null} onSelect={() => {}} />);
    const subDir = screen.getByText("sub");
    // Collapsed by default.
    expect(screen.queryByText("b.md")).not.toBeInTheDocument();
    // Expand
    await user.click(subDir);
    expect(screen.getByText("b.md")).toBeInTheDocument();
    expect(screen.getByText("sub2")).toBeInTheDocument();
    // Collapse again
    await user.click(subDir);
    expect(screen.queryByText("b.md")).not.toBeInTheDocument();
    expect(screen.queryByText("sub2")).not.toBeInTheDocument();
  });

  it("clicking a file calls onSelect with its absolute path", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar files={sample} selectedPath={null} onSelect={onSelect} />);
    await user.click(screen.getByText("a.md"));
    expect(onSelect).toHaveBeenCalledWith("/abs/a.md");
  });

  it("the active path gets the `selected` class", () => {
    render(
      <Sidebar files={sample} selectedPath="/abs/a.md" onSelect={() => {}} />
    );
    const button = screen.getByText("a.md").closest("button")!;
    expect(button.className).toContain("selected");
  });

  it("non-active open paths get the `open` class, not `selected`", () => {
    render(
      <Sidebar
        files={sample}
        selectedPath="/abs/a.md"
        openPaths={new Set(["/abs/a.md", "/abs/z.md"])}
        onSelect={() => {}}
      />
    );
    const z = screen.getByText("z.md").closest("button")!;
    expect(z.className).toContain("open");
    expect(z.className).not.toContain("selected");
  });

  it("auto-expands ancestors of the selected file", () => {
    // Subfolders start collapsed, so the deep file is initially hidden.
    const { rerender } = render(
      <Sidebar files={sample} selectedPath={null} onSelect={() => {}} />
    );
    expect(screen.queryByText("c.md")).not.toBeInTheDocument();
    // Re-render with a deep selection — the effect should expand both
    // `sub` and `sub/sub2` so the file becomes visible.
    rerender(
      <Sidebar
        files={sample}
        selectedPath="/abs/sub/sub2/c.md"
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("c.md")).toBeInTheDocument();
  });

  it("renders the resize handle", () => {
    const { container } = render(
      <Sidebar files={sample} selectedPath={null} onSelect={() => {}} />
    );
    expect(container.querySelector(".sidebar-resize")).not.toBeNull();
  });

  it("nested file tree contains exactly the expected unique entries", async () => {
    const user = userEvent.setup();
    render(<Sidebar files={sample} selectedPath={null} onSelect={() => {}} />);
    // Expand all directories so every leaf is in the DOM.
    await user.click(screen.getByText("sub"));
    await user.click(screen.getByText("sub2"));
    const tree = screen.getByText("Files").parentElement!;
    // Spot-check the rendered list has each leaf exactly once.
    const matches = (text: string) => within(tree).getAllByText(text).length;
    expect(matches("a.md")).toBe(1);
    expect(matches("b.md")).toBe(1);
    expect(matches("c.md")).toBe(1);
    expect(matches("z.md")).toBe(1);
  });
});
