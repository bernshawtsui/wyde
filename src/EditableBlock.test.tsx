import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableBlock } from "./EditableBlock";

function makeNode(
  start: number,
  end: number,
  children?: { tagName: string }[]
) {
  return {
    position: { start: { offset: start }, end: { offset: end } },
    children,
  };
}

describe("EditableBlock", () => {
  it("renders the children inside the requested element", () => {
    const { container } = render(
      <EditableBlock
        as="p"
        node={makeNode(0, 11)}
        source="Hello world"
        onCommit={() => {}}
      >
        Hello world
      </EditableBlock>
    );
    const p = container.querySelector("p");
    expect(p?.textContent).toBe("Hello world");
    expect(p?.className).toContain("editable-block");
  });

  it("single-click does NOT enter edit mode (text selection still works)", async () => {
    const user = userEvent.setup();
    const onEditStart = vi.fn();
    render(
      <EditableBlock
        as="p"
        node={makeNode(0, 5)}
        source="Hello"
        onCommit={() => {}}
        onEditStart={onEditStart}
      >
        Hello
      </EditableBlock>
    );
    await user.click(screen.getByText("Hello"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onEditStart).not.toHaveBeenCalled();
  });

  it("double-click enters edit mode for paragraph", async () => {
    const user = userEvent.setup();
    const onEditStart = vi.fn();
    render(
      <EditableBlock
        as="p"
        node={makeNode(0, 5)}
        source="Hello"
        onCommit={() => {}}
        onEditStart={onEditStart}
      >
        Hello
      </EditableBlock>
    );
    await user.dblClick(screen.getByText("Hello"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it("ATX heading is editable on double-click", async () => {
    const user = userEvent.setup();
    const atxSource = "# Title";
    render(
      <EditableBlock
        as="h1"
        multiline={false}
        node={makeNode(0, atxSource.length)}
        source={atxSource}
        onCommit={() => {}}
      >
        Title
      </EditableBlock>
    );
    await user.dblClick(screen.getByText("Title"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("setext heading renders read-only (no editable-block class)", () => {
    const setext = "Title\n=====";
    const { container } = render(
      <EditableBlock
        as="h1"
        multiline={false}
        node={makeNode(0, setext.length)}
        source={setext}
        onCommit={() => {}}
      >
        Title
      </EditableBlock>
    );
    const h1 = container.querySelector("h1");
    expect(h1?.className || "").not.toContain("editable-block");
  });

  it("a list item with a sublist child renders read-only", () => {
    const { container } = render(
      <EditableBlock
        as="li"
        node={makeNode(0, 20, [{ tagName: "ul" }])}
        source="- outer"
        onCommit={() => {}}
      >
        outer
      </EditableBlock>
    );
    const li = container.querySelector("li");
    expect(li?.className).not.toContain("editable-block");
  });

  it("Cmd+Enter blurs a multi-line editor (commit), plain Enter inserts newline", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const src = "Hello world";
    render(
      <EditableBlock
        as="p"
        node={makeNode(0, src.length)}
        source={src}
        onCommit={onCommit}
      >
        Hello world
      </EditableBlock>
    );
    await user.dblClick(screen.getByText("Hello world"));
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Plain Enter inserts a newline in the textarea (no commit, no blur).
    await user.clear(ta);
    await user.type(ta, "first{Enter}second");
    expect(ta.value).toBe("first\nsecond");
    expect(onCommit).not.toHaveBeenCalled();

    // Cmd+Enter triggers blur → commit.
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][2]).toBe("first\nsecond");
  });

  it("Esc cancels without committing", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <EditableBlock
        as="p"
        node={makeNode(0, 5)}
        source="Hello"
        onCommit={onCommit}
      >
        Hello
      </EditableBlock>
    );
    await user.dblClick(screen.getByText("Hello"));
    const ta = screen.getByRole("textbox");
    await user.type(ta, " edited{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("falls back to read-only when offsets are missing", () => {
    const { container } = render(
      <EditableBlock as="p" source="X" onCommit={() => {}}>
        X
      </EditableBlock>
    );
    const p = container.querySelector("p");
    expect(p?.className).not.toContain("editable-block");
  });
});
