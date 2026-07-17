import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";
import type { Tab } from "./TabContent";

function makeTab(path: string): Tab {
  return { path, kind: "markdown", source: "", widthsByTableOffset: {} };
}

const PANE_ID = "pane-1";

function makeNames(...entries: [string, string][]): Map<string, string> {
  return new Map(entries);
}

describe("TabBar", () => {
  it("renders nothing when there are no tabs", () => {
    const { container } = render(
      <TabBar
        tabs={[]}
        activeIndex={0}
        basenames={new Map()}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one tab per entry with its basename", () => {
    render(
      <TabBar
        tabs={[makeTab("/a/foo.md"), makeTab("/b/bar.md")]}
        activeIndex={0}
        basenames={makeNames(
          ["/a/foo.md", "foo.md"],
          ["/b/bar.md", "bar.md"]
        )}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("foo.md")).toBeInTheDocument();
    expect(screen.getByText("bar.md")).toBeInTheDocument();
  });

  it("the active tab carries the `active` class", () => {
    const { container } = render(
      <TabBar
        tabs={[makeTab("/a"), makeTab("/b")]}
        activeIndex={1}
        basenames={makeNames(["/a", "a"], ["/b", "b"])}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={() => {}}
      />
    );
    const tabs = container.querySelectorAll(".tab");
    expect(tabs[0].className).not.toContain("active");
    expect(tabs[1].className).toContain("active");
  });

  it("clicking a tab calls onActivate(index)", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <TabBar
        tabs={[makeTab("/a"), makeTab("/b")]}
        activeIndex={0}
        basenames={makeNames(["/a", "a"], ["/b", "b"])}
        paneId={PANE_ID}
        onActivate={onActivate}
        onClose={() => {}}
      />
    );
    await user.click(screen.getByText("b"));
    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it("clicking ✕ calls onClose(index) and does NOT bubble to onActivate", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <TabBar
        tabs={[makeTab("/a"), makeTab("/b")]}
        activeIndex={0}
        basenames={makeNames(["/a", "a"], ["/b", "b"])}
        paneId={PANE_ID}
        onActivate={onActivate}
        onClose={onClose}
      />
    );
    const closeBtns = container.querySelectorAll(".tab-close");
    await user.click(closeBtns[1] as HTMLElement);
    expect(onClose).toHaveBeenCalledWith(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("middle-click on a tab calls onClose(index)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <TabBar
        tabs={[makeTab("/a"), makeTab("/b")]}
        activeIndex={0}
        basenames={makeNames(["/a", "a"], ["/b", "b"])}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={onClose}
      />
    );
    const tab = container.querySelectorAll(".tab")[1];
    fireEvent.mouseDown(tab, { button: 1 });
    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("falls back to the path when the basename is missing", () => {
    render(
      <TabBar
        tabs={[makeTab("/a/very/long/path.md")]}
        activeIndex={0}
        basenames={new Map()}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("/a/very/long/path.md")).toBeInTheDocument();
  });

  it("left mouse-down on a tab calls onTabMouseDown(paneId, path, event)", () => {
    const onTabMouseDown = vi.fn();
    const { container } = render(
      <TabBar
        tabs={[makeTab("/a"), makeTab("/b/foo.md")]}
        activeIndex={0}
        basenames={makeNames(["/a", "a"], ["/b/foo.md", "foo.md"])}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={() => {}}
        onTabMouseDown={onTabMouseDown}
      />
    );
    const tab = container.querySelectorAll(".tab")[1];
    fireEvent.mouseDown(tab, { button: 0, clientX: 100, clientY: 50 });
    expect(onTabMouseDown).toHaveBeenCalledTimes(1);
    expect(onTabMouseDown.mock.calls[0][0]).toBe(PANE_ID);
    expect(onTabMouseDown.mock.calls[0][1]).toBe("/b/foo.md");
  });

  it("middle-click does NOT call onTabMouseDown", () => {
    const onTabMouseDown = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <TabBar
        tabs={[makeTab("/a")]}
        activeIndex={0}
        basenames={makeNames(["/a", "a"])}
        paneId={PANE_ID}
        onActivate={() => {}}
        onClose={onClose}
        onTabMouseDown={onTabMouseDown}
      />
    );
    const tab = container.querySelector(".tab")!;
    fireEvent.mouseDown(tab, { button: 1 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onTabMouseDown).not.toHaveBeenCalled();
  });
});
