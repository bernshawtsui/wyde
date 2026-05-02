import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { ResizableTable } from "./ResizableTable";

/**
 * Render a ResizableTable with `numCols` columns. The thead/tbody are
 * passed as *separate* JSX children (not wrapped in a fragment) so
 * `Children.toArray` sees them flat — matches what react-markdown does
 * in production.
 */
function renderTable(
  numCols: number,
  widths?: number[],
  onWidthsChange: (w: number[]) => void = () => {},
  override?: ReactNode
) {
  return render(
    <ResizableTable widths={widths} onWidthsChange={onWidthsChange}>
      <thead>
        <tr>
          {Array.from({ length: numCols }, (_, i) => (
            <th key={i}>col{i}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {Array.from({ length: numCols }, (_, i) => (
            <td key={i}>v{i}</td>
          ))}
        </tr>
      </tbody>
      {override}
    </ResizableTable>
  );
}

describe("ResizableTable", () => {
  it("renders a colgroup with the supplied widths", () => {
    const { container } = renderTable(3, [100, 150, 200]);
    const cols = container.querySelectorAll("colgroup col");
    expect(cols).toHaveLength(3);
    expect((cols[0] as HTMLElement).style.width).toBe("100px");
    expect((cols[1] as HTMLElement).style.width).toBe("150px");
    expect((cols[2] as HTMLElement).style.width).toBe("200px");
  });

  it("uses default widths when widths prop is undefined", () => {
    const { container } = renderTable(3);
    const cols = container.querySelectorAll("colgroup col");
    expect(cols).toHaveLength(3);
    cols.forEach((c) => expect((c as HTMLElement).style.width).toBe("200px"));
  });

  it("falls back to defaults when widths.length doesn't match column count", () => {
    const { container } = renderTable(3, [1, 2]);
    const cols = container.querySelectorAll("colgroup col");
    cols.forEach((c) => expect((c as HTMLElement).style.width).toBe("200px"));
  });

  it("renders one resize handle per column", () => {
    const { container } = renderTable(3, [100, 150, 200]);
    expect(container.querySelectorAll(".resize-handle")).toHaveLength(3);
  });

  it("renders no colgroup when there are no columns", () => {
    const { container } = render(
      <ResizableTable onWidthsChange={() => {}}>
        <tbody>
          <tr>
            <td>orphan</td>
          </tr>
        </tbody>
      </ResizableTable>
    );
    expect(container.querySelector("colgroup")).toBeNull();
  });

  it("commits final widths once on mouseup, not on every mousemove", () => {
    const onWidthsChange = vi.fn();
    const { container } = renderTable(2, [100, 100], onWidthsChange);
    const handle = container.querySelectorAll(".resize-handle")[0]!;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 130 });
    fireEvent.mouseMove(window, { clientX: 160 });
    expect(onWidthsChange).not.toHaveBeenCalled(); // commit-on-drop
    fireEvent.mouseUp(window);
    expect(onWidthsChange).toHaveBeenCalledTimes(1);
    const final = onWidthsChange.mock.calls[0][0];
    expect(final[0]).toBe(160); // 100 + (160 - 100)
    expect(final[1]).toBe(100); // unchanged
  });

  it("clamps the dragged column to MIN_WIDTH (40px)", () => {
    const onWidthsChange = vi.fn();
    const { container } = renderTable(2, [100, 100], onWidthsChange);
    const handle = container.querySelectorAll(".resize-handle")[0]!;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: -500 });
    fireEvent.mouseUp(window);
    expect(onWidthsChange.mock.calls[0][0][0]).toBe(40);
  });

  it("removes the body.resizing class on mouseup", () => {
    const { container } = renderTable(1, [100]);
    const handle = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(handle, { clientX: 100 });
    expect(document.body.classList.contains("resizing")).toBe(true);
    fireEvent.mouseUp(window);
    expect(document.body.classList.contains("resizing")).toBe(false);
  });
});
