import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditableCell } from "./EditableCell";

const SOURCE = `| name |\n| --- |\n| Ada |\n`;
// Ada cell starts at the leading `|` of its row in the source.
// We don't need to compute exact offsets here — the test just hands the
// component a known-good slice. EditableCell uses `rawCellText` internally.
const ADA_START = SOURCE.indexOf("| Ada");
const ADA_END = ADA_START + "| Ada |".length;

const node = {
  position: { start: { offset: ADA_START }, end: { offset: ADA_END } },
};

function renderCell(extra: Partial<Parameters<typeof EditableCell>[0]> = {}) {
  const onCommit = vi.fn();
  const onEditStart = vi.fn();
  const onEditEnd = vi.fn();
  const utils = render(
    <table>
      <tbody>
        <tr>
          <EditableCell
            node={node}
            source={SOURCE}
            onCommit={onCommit}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            {...extra}
          >
            Ada
          </EditableCell>
        </tr>
      </tbody>
    </table>
  );
  return { ...utils, onCommit, onEditStart, onEditEnd };
}

describe("EditableCell", () => {
  it("renders as a plain td initially with the children", () => {
    const { container } = renderCell();
    const cell = container.querySelector("td");
    expect(cell?.textContent).toBe("Ada");
    expect(container.querySelector("input")).toBeNull();
  });

  it("click enters edit mode, focuses + selects the input", async () => {
    const user = userEvent.setup();
    const { onEditStart } = renderCell();
    await user.click(screen.getByText("Ada"));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Ada");
    expect(document.activeElement).toBe(input);
    expect(onEditStart).toHaveBeenCalledTimes(1);
  });

  it("blur commits the new value via onCommit", async () => {
    const user = userEvent.setup();
    const { onCommit, onEditEnd } = renderCell();
    await user.click(screen.getByText("Ada"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Ada Lovelace");
    input.blur();
    expect(onCommit).toHaveBeenCalledWith(ADA_START, "Ada Lovelace");
    expect(onEditEnd).toHaveBeenCalledTimes(1);
  });

  it("Enter blurs and commits", async () => {
    const user = userEvent.setup();
    const { onCommit } = renderCell();
    await user.click(screen.getByText("Ada"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Bertha{Enter}");
    expect(onCommit).toHaveBeenCalledWith(ADA_START, "Bertha");
  });

  it("Escape cancels — onEditStart fired but onCommit never called", async () => {
    const user = userEvent.setup();
    const { onCommit, onEditStart, onEditEnd } = renderCell();
    await user.click(screen.getByText("Ada"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "Will not save{Escape}");
    expect(onEditStart).toHaveBeenCalledTimes(1);
    expect(onEditEnd).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("blur with unchanged value does not commit (no-op)", async () => {
    const user = userEvent.setup();
    const { onCommit } = renderCell();
    await user.click(screen.getByText("Ada"));
    const input = screen.getByRole("textbox");
    input.blur();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("falls back to read-only td when offsets are missing", () => {
    const { container } = renderCell({ node: undefined });
    const cell = container.querySelector("td");
    expect(cell?.textContent).toBe("Ada");
    // No interaction wires up an input.
    expect(container.querySelector("input")).toBeNull();
  });
});
