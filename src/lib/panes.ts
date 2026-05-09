import type { Tab } from "../TabContent";

export interface Pane {
  /** Stable id (random uuid). Survives reorders, moves, and auto-collapse. */
  id: string;
  tabs: Tab[];
  activeIndex: number;
}

export type DropZone = "tabs" | "left" | "right";

export interface MoveArgs {
  fromPaneId: string;
  toPaneId: string;
  path: string;
  zone: DropZone;
}

export interface CloseResult {
  panes: Pane[];
  splitRatio: number;
  focusedPaneId: string;
}

export interface MoveResult {
  panes: Pane[];
  splitRatio: number;
  focusedPaneId: string;
}

export const DEFAULT_SPLIT_RATIO = 0.5;

function clampActive(tabs: Tab[], activeIndex: number): number {
  if (tabs.length === 0) return 0;
  return Math.max(0, Math.min(activeIndex, tabs.length - 1));
}

function newPaneId(): string {
  return crypto.randomUUID();
}

export function makePane(tabs: Tab[] = [], activeIndex = 0): Pane {
  return { id: newPaneId(), tabs, activeIndex: clampActive(tabs, activeIndex) };
}

export function findPaneByPath(
  panes: Pane[],
  path: string
): { paneId: string; index: number } | null {
  for (const p of panes) {
    const i = p.tabs.findIndex((t) => t.path === path);
    if (i !== -1) return { paneId: p.id, index: i };
  }
  return null;
}

/**
 * Append a tab to a pane and activate it. If the path already exists in any
 * pane, no-op on the data (caller is expected to use the returned focusedPaneId
 * to switch focus and the path's existing index to set activeIndex).
 */
export function addTabToPane(
  panes: Pane[],
  paneId: string,
  tab: Tab
): { panes: Pane[]; focusedPaneId: string } {
  const existing = findPaneByPath(panes, tab.path);
  if (existing) {
    return {
      panes: panes.map((p) =>
        p.id === existing.paneId ? { ...p, activeIndex: existing.index } : p
      ),
      focusedPaneId: existing.paneId,
    };
  }
  return {
    panes: panes.map((p) =>
      p.id === paneId
        ? { ...p, tabs: [...p.tabs, tab], activeIndex: p.tabs.length }
        : p
    ),
    focusedPaneId: paneId,
  };
}

/**
 * Activate an already-open path. Sets the activeIndex of the pane that holds
 * it, and returns that pane's id so callers can update focus. If the path
 * isn't open, returns the panes unchanged and focusedPaneId unchanged.
 */
export function activatePath(
  panes: Pane[],
  path: string,
  currentFocusedPaneId: string
): { panes: Pane[]; focusedPaneId: string } {
  const found = findPaneByPath(panes, path);
  if (!found) return { panes, focusedPaneId: currentFocusedPaneId };
  return {
    panes: panes.map((p) =>
      p.id === found.paneId ? { ...p, activeIndex: found.index } : p
    ),
    focusedPaneId: found.paneId,
  };
}

/**
 * Close the tab at `index` in `paneId`. If the pane becomes empty AND there
 * is another pane, the empty pane is removed (auto-collapse) and splitRatio
 * resets to DEFAULT_SPLIT_RATIO. Otherwise the (possibly-empty) pane stays.
 */
export function closeTabInPane(
  panes: Pane[],
  paneId: string,
  index: number,
  splitRatio: number,
  focusedPaneId: string
): CloseResult {
  const target = panes.find((p) => p.id === paneId);
  if (!target || index < 0 || index >= target.tabs.length) {
    return { panes, splitRatio, focusedPaneId };
  }
  const nextTabs = target.tabs.filter((_, i) => i !== index);
  // After removal: if we removed the active tab, clamp; otherwise shift
  // activeIndex left when the removed index was before it.
  let nextActive = target.activeIndex;
  if (index < target.activeIndex) {
    nextActive = target.activeIndex - 1;
  } else if (index === target.activeIndex) {
    nextActive = Math.min(target.activeIndex, nextTabs.length - 1);
  }
  nextActive = clampActive(nextTabs, nextActive);

  const updated: Pane = { ...target, tabs: nextTabs, activeIndex: nextActive };

  if (nextTabs.length === 0 && panes.length > 1) {
    // Auto-collapse the now-empty pane.
    const survivors = panes.filter((p) => p.id !== paneId);
    const nextFocused =
      focusedPaneId === paneId ? survivors[0].id : focusedPaneId;
    return {
      panes: survivors,
      splitRatio: DEFAULT_SPLIT_RATIO,
      focusedPaneId: nextFocused,
    };
  }

  return {
    panes: panes.map((p) => (p.id === paneId ? updated : p)),
    splitRatio,
    focusedPaneId,
  };
}

/**
 * Move (or split) a tab according to a drop. Performs move + auto-collapse in
 * one step so callers never observe a transient empty source pane.
 *
 *  - same pane + zone='tabs'                       → no-op
 *  - same pane + zone='left'/'right'               → no-op (would empty source)
 *  - cross pane + zone='tabs'                      → remove from src, append to dst
 *  - single-pane source with >1 tabs + zone='left'/'right'
 *                                                  → split: new pane on that side
 *                                                    holding only the moved tab
 *  - single-pane source with 1 tab + 'left'/'right'→ no-op (would empty source)
 *  - two-pane setup + zone='left'/'right' on OTHER pane
 *                                                  → move into target (append)
 */
export function movePaneTab(
  panes: Pane[],
  args: MoveArgs,
  splitRatio: number
): MoveResult {
  const { fromPaneId, toPaneId, path, zone } = args;
  const src = panes.find((p) => p.id === fromPaneId);
  if (!src) return { panes, splitRatio, focusedPaneId: fromPaneId };

  const movedIndex = src.tabs.findIndex((t) => t.path === path);
  if (movedIndex === -1)
    return { panes, splitRatio, focusedPaneId: fromPaneId };
  const movedTab = src.tabs[movedIndex];

  // No-op: same pane, tab-strip drop (reorder is out of v1 scope).
  if (fromPaneId === toPaneId && zone === "tabs") {
    return { panes, splitRatio, focusedPaneId: fromPaneId };
  }

  // No-op: dragging the only tab in a pane onto any side zone would empty
  // its source for no useful state change.
  if (src.tabs.length === 1 && (zone === "left" || zone === "right")) {
    return { panes, splitRatio, focusedPaneId: fromPaneId };
  }

  // Compute the source pane after removal.
  const srcAfterTabs = src.tabs.filter((_, i) => i !== movedIndex);
  let srcActive = src.activeIndex;
  if (movedIndex < src.activeIndex) {
    srcActive = src.activeIndex - 1;
  } else if (movedIndex === src.activeIndex) {
    srcActive = Math.min(src.activeIndex, srcAfterTabs.length - 1);
  }
  srcActive = clampActive(srcAfterTabs, srcActive);
  const srcAfter: Pane = { ...src, tabs: srcAfterTabs, activeIndex: srcActive };

  // Single-pane source + side zone = SPLIT. The caller passes
  // toPaneId === fromPaneId in this case (no second pane exists to address).
  if (
    panes.length === 1 &&
    fromPaneId === toPaneId &&
    (zone === "left" || zone === "right")
  ) {
    const newPane: Pane = makePane([movedTab], 0);
    const ordered =
      zone === "left" ? [newPane, srcAfter] : [srcAfter, newPane];
    return {
      panes: ordered,
      splitRatio: DEFAULT_SPLIT_RATIO,
      focusedPaneId: newPane.id,
    };
  }

  // Same-pane side-zone drop in a TWO-pane layout = no-op (overlays should
  // be suppressed on the source pane, but defend against it anyway).
  if (fromPaneId === toPaneId) {
    return { panes, splitRatio, focusedPaneId: fromPaneId };
  }

  // Cross-pane move into existing target (zone='tabs' or zone='left'/'right'
  // on the OTHER pane in a two-pane layout).
  const target = panes.find((p) => p.id === toPaneId);
  if (!target) {
    return { panes, splitRatio, focusedPaneId: fromPaneId };
  }
  const dstTabs = [...target.tabs, movedTab];
  const dstAfter: Pane = {
    ...target,
    tabs: dstTabs,
    activeIndex: dstTabs.length - 1,
  };
  let nextPanes = panes.map((p) => {
    if (p.id === fromPaneId) return srcAfter;
    if (p.id === toPaneId) return dstAfter;
    return p;
  });
  let nextSplit = splitRatio;
  if (srcAfterTabs.length === 0 && nextPanes.length > 1) {
    nextPanes = nextPanes.filter((p) => p.id !== fromPaneId);
    nextSplit = DEFAULT_SPLIT_RATIO;
  }
  return {
    panes: nextPanes,
    splitRatio: nextSplit,
    focusedPaneId: toPaneId,
  };
}

/**
 * Cycle the active tab inside a single pane. Direction +1 advances, -1 goes
 * back; both wrap. Operates on the named pane; other panes untouched.
 */
export function cycleActiveTab(
  panes: Pane[],
  paneId: string,
  direction: 1 | -1
): Pane[] {
  return panes.map((p) => {
    if (p.id !== paneId) return p;
    if (p.tabs.length < 2) return p;
    const n = p.tabs.length;
    const nextIndex =
      direction === 1
        ? (p.activeIndex + 1) % n
        : (p.activeIndex - 1 + n) % n;
    return { ...p, activeIndex: nextIndex };
  });
}

/**
 * Flatten all open paths across all panes (used to derive `openPaths` for
 * the sidebar, and to back the global per-path edit/refresh tracking).
 */
export function allOpenPaths(panes: Pane[]): string[] {
  const out: string[] = [];
  for (const p of panes) for (const t of p.tabs) out.push(t.path);
  return out;
}
