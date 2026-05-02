import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabBar } from "./TabBar";
import type { Tab } from "./TabContent";

function makeTab(path: string): Tab {
  return { path, source: "", widthsByTableOffset: {} };
}

describe("TabBar", () => {
  it("renders nothing when there are no tabs", () => {
    const { container } = render(
      <TabBar
        tabs={[]}
        activeIndex={0}
        basenames={[]}
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
        basenames={["foo.md", "bar.md"]}
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
        basenames={["a", "b"]}
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
        basenames={["a", "b"]}
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
        basenames={["a", "b"]}
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
        basenames={["a", "b"]}
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
        basenames={[]}
        onActivate={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("/a/very/long/path.md")).toBeInTheDocument();
  });
});
