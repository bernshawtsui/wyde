import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPLIT_RATIO,
  activatePath,
  addTabToPane,
  allOpenPaths,
  closeTabInPane,
  cycleActiveTab,
  findPaneByPath,
  makePane,
  movePaneTab,
  type Pane,
} from "./panes";
import type { Tab } from "../TabContent";

function tab(path: string): Tab {
  return { path, source: `# ${path}`, widthsByTableOffset: {} };
}

function singlePane(...tabs: Tab[]): Pane[] {
  return [makePane(tabs, 0)];
}

describe("findPaneByPath", () => {
  it("finds path in second pane", () => {
    const panes = [makePane([tab("/a")], 0), makePane([tab("/b"), tab("/c")], 0)];
    expect(findPaneByPath(panes, "/c")).toEqual({
      paneId: panes[1].id,
      index: 1,
    });
  });

  it("returns null when no pane holds the path", () => {
    const panes = singlePane(tab("/a"));
    expect(findPaneByPath(panes, "/missing")).toBeNull();
  });
});

describe("addTabToPane", () => {
  it("appends a new tab and activates it", () => {
    const panes = singlePane(tab("/a"));
    const t = tab("/b");
    const { panes: next, focusedPaneId } = addTabToPane(panes, panes[0].id, t);
    expect(next[0].tabs).toHaveLength(2);
    expect(next[0].activeIndex).toBe(1);
    expect(focusedPaneId).toBe(panes[0].id);
  });

  it("if the path is already open, does NOT duplicate; activates existing", () => {
    const t = tab("/a");
    const panes = [makePane([tab("/x")], 0), makePane([t, tab("/y")], 1)];
    const { panes: next, focusedPaneId } = addTabToPane(
      panes,
      panes[0].id,
      tab("/a")
    );
    // pane[1] already had /a at index 0; addTab should activate it there.
    expect(next[1].tabs.map((tab) => tab.path)).toEqual(["/a", "/y"]);
    expect(next[1].activeIndex).toBe(0);
    expect(focusedPaneId).toBe(panes[1].id);
    // Ensure pane[0] untouched.
    expect(next[0].tabs).toEqual(panes[0].tabs);
  });
});

describe("activatePath", () => {
  it("activates the tab in the pane that holds it and shifts focus", () => {
    const panes = [
      makePane([tab("/a"), tab("/b")], 0),
      makePane([tab("/c"), tab("/d")], 0),
    ];
    const { panes: next, focusedPaneId } = activatePath(panes, "/d", panes[0].id);
    expect(next[1].activeIndex).toBe(1);
    expect(focusedPaneId).toBe(panes[1].id);
  });

  it("no-op when path not found", () => {
    const panes = singlePane(tab("/a"));
    const { panes: next, focusedPaneId } = activatePath(panes, "/zz", panes[0].id);
    expect(next).toBe(panes);
    expect(focusedPaneId).toBe(panes[0].id);
  });
});

describe("closeTabInPane", () => {
  it("removes the tab and shifts activeIndex left when removed before active", () => {
    const panes = [makePane([tab("/a"), tab("/b"), tab("/c")], 2)];
    const r = closeTabInPane(panes, panes[0].id, 0, 0.5, panes[0].id);
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/b", "/c"]);
    expect(r.panes[0].activeIndex).toBe(1);
  });

  it("removing the active last tab clamps activeIndex to new length-1", () => {
    const panes = [makePane([tab("/a"), tab("/b")], 1)];
    const r = closeTabInPane(panes, panes[0].id, 1, 0.5, panes[0].id);
    expect(r.panes[0].tabs).toHaveLength(1);
    expect(r.panes[0].activeIndex).toBe(0);
  });

  it("auto-collapses when a pane is emptied in a two-pane layout", () => {
    const left = makePane([tab("/a")], 0);
    const right = makePane([tab("/b")], 0);
    const r = closeTabInPane([left, right], left.id, 0, 0.7, left.id);
    expect(r.panes).toHaveLength(1);
    expect(r.panes[0].id).toBe(right.id);
    expect(r.splitRatio).toBe(DEFAULT_SPLIT_RATIO);
    expect(r.focusedPaneId).toBe(right.id);
  });

  it("keeps the only single empty pane (do not delete the last pane)", () => {
    const panes = [makePane([tab("/a")], 0)];
    const r = closeTabInPane(panes, panes[0].id, 0, 0.5, panes[0].id);
    expect(r.panes).toHaveLength(1);
    expect(r.panes[0].tabs).toEqual([]);
  });

  it("ignores out-of-range index", () => {
    const panes = [makePane([tab("/a")], 0)];
    const r = closeTabInPane(panes, panes[0].id, 99, 0.5, panes[0].id);
    expect(r.panes).toBe(panes);
  });
});

describe("movePaneTab", () => {
  it("single-pane source + zone='right' creates a new right pane with the moved tab", () => {
    const panes = singlePane(tab("/a"), tab("/b"), tab("/c"));
    const r = movePaneTab(
      panes,
      { fromPaneId: panes[0].id, toPaneId: panes[0].id, path: "/b", zone: "right" },
      0.5
    );
    expect(r.panes).toHaveLength(2);
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/a", "/c"]);
    expect(r.panes[1].tabs.map((t) => t.path)).toEqual(["/b"]);
    expect(r.focusedPaneId).toBe(r.panes[1].id);
    expect(r.splitRatio).toBe(DEFAULT_SPLIT_RATIO);
  });

  it("single-pane source + zone='left' puts the new pane on the LEFT", () => {
    const panes = singlePane(tab("/a"), tab("/b"));
    const r = movePaneTab(
      panes,
      { fromPaneId: panes[0].id, toPaneId: panes[0].id, path: "/b", zone: "left" },
      0.5
    );
    expect(r.panes).toHaveLength(2);
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/b"]);
    expect(r.panes[1].tabs.map((t) => t.path)).toEqual(["/a"]);
  });

  it("PRESERVES Tab object identity across a move (column widths survive)", () => {
    const movedTab: Tab = {
      path: "/b",
      source: "...",
      widthsByTableOffset: { 12: [100, 200, 300] },
    };
    const panes = singlePane(tab("/a"), movedTab);
    const r = movePaneTab(
      panes,
      { fromPaneId: panes[0].id, toPaneId: panes[0].id, path: "/b", zone: "right" },
      0.5
    );
    expect(r.panes[1].tabs[0]).toBe(movedTab);
    expect(r.panes[1].tabs[0].widthsByTableOffset).toEqual({
      12: [100, 200, 300],
    });
  });

  it("single-tab source onto its own side zone is a no-op (would empty source)", () => {
    const panes = singlePane(tab("/a"));
    const r = movePaneTab(
      panes,
      { fromPaneId: panes[0].id, toPaneId: panes[0].id, path: "/a", zone: "right" },
      0.5
    );
    expect(r.panes).toBe(panes);
  });

  it("same pane + zone='tabs' is a no-op (reorder out of v1 scope)", () => {
    const panes = singlePane(tab("/a"), tab("/b"));
    const r = movePaneTab(
      panes,
      { fromPaneId: panes[0].id, toPaneId: panes[0].id, path: "/a", zone: "tabs" },
      0.5
    );
    expect(r.panes).toBe(panes);
  });

  it("cross-pane zone='tabs' moves the tab and activates it in the target", () => {
    const left = makePane([tab("/a"), tab("/b")], 0);
    const right = makePane([tab("/c")], 0);
    const r = movePaneTab(
      [left, right],
      { fromPaneId: left.id, toPaneId: right.id, path: "/b", zone: "tabs" },
      0.5
    );
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/a"]);
    expect(r.panes[1].tabs.map((t) => t.path)).toEqual(["/c", "/b"]);
    expect(r.panes[1].activeIndex).toBe(1);
    expect(r.focusedPaneId).toBe(right.id);
  });

  it("cross-pane move that empties the source auto-collapses to one pane", () => {
    const left = makePane([tab("/a")], 0);
    const right = makePane([tab("/b")], 0);
    const r = movePaneTab(
      [left, right],
      { fromPaneId: left.id, toPaneId: right.id, path: "/a", zone: "tabs" },
      0.7
    );
    expect(r.panes).toHaveLength(1);
    expect(r.panes[0].id).toBe(right.id);
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/b", "/a"]);
    expect(r.splitRatio).toBe(DEFAULT_SPLIT_RATIO);
  });

  it("two-pane layout, drop on OTHER pane's side zone, moves into that pane", () => {
    const left = makePane([tab("/a"), tab("/b")], 1);
    const right = makePane([tab("/c")], 0);
    const r = movePaneTab(
      [left, right],
      { fromPaneId: left.id, toPaneId: right.id, path: "/b", zone: "left" },
      0.5
    );
    expect(r.panes[0].tabs.map((t) => t.path)).toEqual(["/a"]);
    expect(r.panes[1].tabs.map((t) => t.path)).toEqual(["/c", "/b"]);
  });
});

describe("cycleActiveTab", () => {
  it("wraps forward", () => {
    const panes = [makePane([tab("/a"), tab("/b"), tab("/c")], 2)];
    const next = cycleActiveTab(panes, panes[0].id, 1);
    expect(next[0].activeIndex).toBe(0);
  });

  it("wraps backward", () => {
    const panes = [makePane([tab("/a"), tab("/b")], 0)];
    const next = cycleActiveTab(panes, panes[0].id, -1);
    expect(next[0].activeIndex).toBe(1);
  });

  it("only cycles the named pane", () => {
    const left = makePane([tab("/a"), tab("/b")], 0);
    const right = makePane([tab("/c"), tab("/d")], 1);
    const next = cycleActiveTab([left, right], left.id, 1);
    expect(next[0].activeIndex).toBe(1);
    expect(next[1].activeIndex).toBe(1); // unchanged
  });

  it("no-op when pane has < 2 tabs", () => {
    const panes = [makePane([tab("/a")], 0)];
    const next = cycleActiveTab(panes, panes[0].id, 1);
    expect(next[0].activeIndex).toBe(0);
  });
});

describe("allOpenPaths", () => {
  it("flattens paths across panes in order", () => {
    const panes = [
      makePane([tab("/a"), tab("/b")], 0),
      makePane([tab("/c")], 0),
    ];
    expect(allOpenPaths(panes)).toEqual(["/a", "/b", "/c"]);
  });
});
