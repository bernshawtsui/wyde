import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { basename } from "@tauri-apps/api/path";
import {
  WebviewWindow,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { Sidebar } from "./Sidebar";
import { Pane } from "./Pane";
import { type Tab } from "./TabContent";
import { loadFile, writeFile } from "./fs";
import { type DecodedFile, fileKindForPath, type TabKind } from "./lib/fileType";
import { useDragDropFolder } from "./hooks/useDragDropFolder";
import { useFolderFiles } from "./hooks/useFolderFiles";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useZoom } from "./hooks/useZoom";
import { errorMessage } from "./lib/error";
import {
  DEFAULT_SPLIT_RATIO,
  type DropZone,
  type Pane as PaneState,
  activatePath,
  addTabToPane,
  allOpenPaths,
  closeTabInPane,
  cycleActiveTab,
  findPaneByPath,
  makePane,
  movePaneTab,
} from "./lib/panes";

const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.8;
const DRAG_THRESHOLD_PX = 5;

/** Derive a tab's rendered kind and in-memory text from a loaded file. */
function tabFieldsFor(
  path: string,
  loaded: DecodedFile
): { kind: TabKind; source: string } {
  if (loaded.kind === "binary") return { kind: "binary", source: "" };
  return { kind: fileKindForPath(path), source: loaded.text };
}

export default function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [{ panes, focusedPaneId }, setPaneState] = useState<{
    panes: PaneState[];
    focusedPaneId: string;
  }>(() => {
    const first = makePane();
    return { panes: [first], focusedPaneId: first.id };
  });
  const focusPane = useCallback((id: string) => {
    setPaneState((prev) =>
      prev.focusedPaneId === id ? prev : { ...prev, focusedPaneId: id }
    );
  }, []);
  const [splitRatio, setSplitRatio] = useState<number>(DEFAULT_SPLIT_RATIO);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Tab-drag state. Tauri's `dragDropEnabled: true` (needed for folder-drop
  // onto the window) disables HTML5 drag in the webview, so we run our own
  // mouse-based drag instead. `dragSourcePaneId` is non-null once a drag
  // crosses the movement threshold; `hoverZone` is the zone under the cursor.
  const [dragSourcePaneId, setDragSourcePaneId] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<{
    paneId: string;
    zone: DropZone;
  } | null>(null);
  // Per-pane find-in-page state. Visible bars are independent across panes;
  // `focusBump` is incremented when ⌘F is pressed while already visible so
  // the SearchBar can re-focus its input.
  const [paneSearch, setPaneSearch] = useState<
    Record<string, { visible: boolean; query: string; focusBump: number }>
  >({});

  const {
    files,
    error: filesError,
    refresh: refreshFolder,
  } = useFolderFiles(folderPath);

  // Per-path edit/refresh tracking. Paths are unique across all panes (we
  // dedupe at openTab time), so a path-keyed map remains correct.
  const editingCountRef = useRef<Map<string, number>>(new Map());
  const pendingRefreshRef = useRef<Set<string>>(new Set());
  const panesRef = useRef<PaneState[]>(panes);
  const focusedPaneIdRef = useRef<string>(focusedPaneId);
  const splitRatioRef = useRef<number>(splitRatio);
  const panesRowRef = useRef<HTMLDivElement | null>(null);
  const splitDragRef = useRef<{ rect: DOMRect } | null>(null);
  // Mouse-down origin recorded by TabBar; only promoted to a real drag once
  // movement exceeds DRAG_THRESHOLD_PX.
  const dragOriginRef = useRef<{
    sourcePaneId: string;
    path: string;
    startX: number;
    startY: number;
  } | null>(null);
  const dragSourcePaneIdRef = useRef<string | null>(null);
  // Set when a drag actually started (past threshold). Read by onActivateTab
  // to suppress the click that follows the mouseup of the drag.
  const dragSuppressClickRef = useRef<boolean>(false);

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);
  useEffect(() => {
    focusedPaneIdRef.current = focusedPaneId;
  }, [focusedPaneId]);
  useEffect(() => {
    splitRatioRef.current = splitRatio;
  }, [splitRatio]);
  useEffect(() => {
    dragSourcePaneIdRef.current = dragSourcePaneId;
  }, [dragSourcePaneId]);

  useEffect(() => {
    if (filesError) setError(filesError);
  }, [filesError]);

  const focusedPane: PaneState =
    panes.find((p) => p.id === focusedPaneId) ?? panes[0];
  const activeTab: Tab | undefined = focusedPane.tabs[focusedPane.activeIndex];
  const activePath = activeTab?.path ?? null;

  const openPaths = useMemo(
    () => new Set(allOpenPaths(panes)),
    [panes]
  );

  // Tab basenames for display, keyed by path. Resolved async via Tauri's
  // path lib for any newly-seen path.
  const [basenamesByPath, setBasenamesByPath] = useState<Map<string, string>>(
    new Map()
  );
  useEffect(() => {
    let cancelled = false;
    const paths = Array.from(new Set(allOpenPaths(panes)));
    // Compute basenames only for paths we don't already know.
    const missing = paths.filter((p) => !basenamesByPath.has(p));
    if (missing.length === 0) return;
    Promise.all(missing.map((p) => basename(p).catch(() => p))).then(
      (names) => {
        if (cancelled) return;
        setBasenamesByPath((prev) => {
          const next = new Map(prev);
          missing.forEach((p, i) => next.set(p, names[i]));
          return next;
        });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [panes, basenamesByPath]);

  const updateTab = useCallback(
    (path: string, mutator: (t: Tab) => Tab) => {
      setPaneState((prev) => ({
        ...prev,
        panes: prev.panes.map((p) => ({
          ...p,
          tabs: p.tabs.map((t) => (t.path === path ? mutator(t) : t)),
        })),
      }));
    },
    []
  );

  const refreshTab = useCallback(async (path: string) => {
    try {
      const fields = tabFieldsFor(path, await loadFile(path));
      setPaneState((prev) => ({
        ...prev,
        panes: prev.panes.map((p) => ({
          ...p,
          tabs: p.tabs.map((t) =>
            t.path === path ? { ...t, ...fields } : t
          ),
        })),
      }));
      setError(null);
    } catch (e) {
      setError(`load: ${errorMessage(e)}`);
    }
  }, []);

  const onWatcherChange = useCallback(
    (path: string) => {
      const editing = editingCountRef.current.get(path) ?? 0;
      if (editing > 0) {
        pendingRefreshRef.current.add(path);
        return;
      }
      void refreshTab(path);
    },
    [refreshTab]
  );

  const onEditStart = useCallback((path: string) => {
    const next = (editingCountRef.current.get(path) ?? 0) + 1;
    editingCountRef.current.set(path, next);
  }, []);

  const onEditEnd = useCallback(
    (path: string) => {
      const next = Math.max(0, (editingCountRef.current.get(path) ?? 0) - 1);
      editingCountRef.current.set(path, next);
      if (next === 0 && pendingRefreshRef.current.has(path)) {
        pendingRefreshRef.current.delete(path);
        void refreshTab(path);
      }
    },
    [refreshTab]
  );

  const onSourceCommit = useCallback(
    async (path: string, next: string) => {
      updateTab(path, (t) => ({ ...t, source: next }));
      setSaveStatus("saving…");
      try {
        await writeFile(path, next);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 1200);
      } catch (e) {
        setSaveStatus("");
        setError(`save: ${errorMessage(e)}`);
      }
    },
    [updateTab]
  );

  const onWidthsChange = useCallback(
    (path: string, tableOffset: number, w: number[]) => {
      updateTab(path, (t) => ({
        ...t,
        widthsByTableOffset: { ...t.widthsByTableOffset, [tableOffset]: w },
      }));
    },
    [updateTab]
  );

  const openTab = useCallback(async (path: string) => {
    // If already open in any pane, just activate it there and shift focus.
    const existing = findPaneByPath(panesRef.current, path);
    if (existing) {
      const { panes: next, focusedPaneId: nextFocused } = activatePath(
        panesRef.current,
        path,
        focusedPaneIdRef.current
      );
      setPaneState({ panes: next, focusedPaneId: nextFocused });
      return;
    }
    try {
      const newTab: Tab = {
        path,
        ...tabFieldsFor(path, await loadFile(path)),
        widthsByTableOffset: {},
      };
      const target = focusedPaneIdRef.current;
      const { panes: next, focusedPaneId: nextFocused } = addTabToPane(
        panesRef.current,
        target,
        newTab
      );
      setPaneState({ panes: next, focusedPaneId: nextFocused });
    } catch (e) {
      setError(`load: ${errorMessage(e)}`);
    }
  }, []);

  const onActivateTab = useCallback((paneId: string, index: number) => {
    // The click event fires after a drag's mouseup. If a drag actually
    // happened, skip activation and clear the flag for the next interaction.
    if (dragSuppressClickRef.current) {
      dragSuppressClickRef.current = false;
      return;
    }
    setPaneState((prev) => ({
      panes: prev.panes.map((p) =>
        p.id === paneId ? { ...p, activeIndex: index } : p
      ),
      focusedPaneId: paneId,
    }));
  }, []);

  const onCloseTab = useCallback((paneId: string, index: number) => {
    const closed = panesRef.current
      .find((p) => p.id === paneId)
      ?.tabs[index];
    const r = closeTabInPane(
      panesRef.current,
      paneId,
      index,
      splitRatioRef.current,
      focusedPaneIdRef.current
    );
    setPaneState({ panes: r.panes, focusedPaneId: r.focusedPaneId });
    setSplitRatio(r.splitRatio);
    // Prune search state for panes that no longer exist.
    setPaneSearch((prev) => {
      const live = new Set(r.panes.map((p) => p.id));
      let changed = false;
      const next: typeof prev = {};
      for (const [k, v] of Object.entries(prev)) {
        if (live.has(k)) next[k] = v;
        else changed = true;
      }
      return changed ? next : prev;
    });
    // If the path is no longer open anywhere, drop its tracking.
    if (closed) {
      const stillOpen = r.panes.some((p) =>
        p.tabs.some((t) => t.path === closed.path)
      );
      if (!stillOpen) {
        editingCountRef.current.delete(closed.path);
        pendingRefreshRef.current.delete(closed.path);
      }
    }
  }, []);

  const closeActiveTab = useCallback(() => {
    const pane = panesRef.current.find((p) => p.id === focusedPaneIdRef.current);
    if (!pane || pane.tabs.length === 0) return;
    onCloseTab(pane.id, pane.activeIndex);
  }, [onCloseTab]);

  const nextTab = useCallback(() => {
    setPaneState((prev) => ({
      ...prev,
      panes: cycleActiveTab(prev.panes, focusedPaneIdRef.current, 1),
    }));
  }, []);

  const prevTab = useCallback(() => {
    setPaneState((prev) => ({
      ...prev,
      panes: cycleActiveTab(prev.panes, focusedPaneIdRef.current, -1),
    }));
  }, []);

  const onTabMouseDown = useCallback(
    (paneId: string, path: string, e: ReactMouseEvent) => {
      // Reset the "ignore next click" flag from any prior interaction.
      dragSuppressClickRef.current = false;
      dragOriginRef.current = {
        sourcePaneId: paneId,
        path,
        startX: e.clientX,
        startY: e.clientY,
      };
      // Suppress text selection from the first pixel of a potential drag —
      // BEFORE we know whether it'll cross the threshold. Avoids the brief
      // window where the browser selects text in the markdown content as the
      // cursor passes through it. We do NOT preventDefault() here because
      // that would also block focus changes (e.g., blurring an editing cell).
      document.body.classList.add("tab-mousedown");
    },
    []
  );

  // Window-level mouse tracking for the in-progress tab drag.
  useEffect(() => {
    function hitTestZone(
      x: number,
      y: number
    ): { paneId: string; zone: DropZone } | null {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const zoneEl = el.closest<HTMLElement>("[data-drop-zone]");
      if (!zoneEl) return null;
      const paneId = zoneEl.dataset.paneId;
      const zone = zoneEl.dataset.dropZone as DropZone | undefined;
      if (!paneId || !zone) return null;
      return { paneId, zone };
    }

    function onMove(e: MouseEvent) {
      const origin = dragOriginRef.current;
      if (!origin) return;
      const dx = e.clientX - origin.startX;
      const dy = e.clientY - origin.startY;
      const isDragging = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
      if (!isDragging) return;
      // Promote to a real drag the first time we cross the threshold.
      if (dragSourcePaneIdRef.current !== origin.sourcePaneId) {
        setDragSourcePaneId(origin.sourcePaneId);
        dragSuppressClickRef.current = true;
        document.body.classList.add("tab-dragging");
        // Clear any selection that snuck in before tab-mousedown took effect
        // (some content elements may override user-select).
        window.getSelection()?.removeAllRanges();
      }
      const hit = hitTestZone(e.clientX, e.clientY);
      // Only consider hits on a different pane unless this pane is allowed
      // to split itself (single-pane mode with multiple tabs).
      setHoverZone((prev) => {
        if (!hit) return prev === null ? prev : null;
        if (prev?.paneId === hit.paneId && prev.zone === hit.zone) return prev;
        return hit;
      });
    }

    function onUp(e: MouseEvent) {
      const origin = dragOriginRef.current;
      dragOriginRef.current = null;
      if (!origin) return;
      const wasDragging = dragSourcePaneIdRef.current === origin.sourcePaneId;
      document.body.classList.remove("tab-mousedown", "tab-dragging");
      if (wasDragging) {
        const hit = hitTestZone(e.clientX, e.clientY);
        if (hit) {
          const r = movePaneTab(
            panesRef.current,
            {
              fromPaneId: origin.sourcePaneId,
              toPaneId: hit.paneId,
              path: origin.path,
              zone: hit.zone,
            },
            splitRatioRef.current
          );
          setPaneState({
            panes: r.panes,
            focusedPaneId: r.focusedPaneId,
          });
          setSplitRatio(r.splitRatio);
        }
      }
      setDragSourcePaneId(null);
      setHoverZone(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onSelectFile = useCallback(
    (path: string) => {
      void openTab(path);
    },
    [openTab]
  );

  // Auto-pick a file when the folder loads / changes. Prefer test.md, then the
  // first markdown file, then the first file of any kind — so a fresh open
  // lands on readable prose rather than, say, a binary.
  useEffect(() => {
    if (!folderPath) return;
    if (files.length === 0) {
      const fresh = makePane();
      setPaneState({ panes: [fresh], focusedPaneId: fresh.id });
      return;
    }
    // Only auto-pick when nothing is open yet (fresh folder open).
    if (allOpenPaths(panesRef.current).length > 0) return;
    const test = files.find((f) => f.name === "test.md");
    const firstMarkdown = files.find(
      (f) => fileKindForPath(f.path) === "markdown"
    );
    const first = test ?? firstMarkdown ?? files[0];
    void openTab(first.path);
  }, [files, folderPath, openTab]);

  const openFolder = useCallback(async (absPath: string) => {
    // New folder: drop existing tabs, clear edit/refresh tracking.
    const fresh = makePane();
    setPaneState({ panes: [fresh], focusedPaneId: fresh.id });
    setSplitRatio(DEFAULT_SPLIT_RATIO);
    setBasenamesByPath(new Map());
    editingCountRef.current.clear();
    pendingRefreshRef.current.clear();
    setFolderPath(absPath);
    setError(null);
    try {
      const name = await basename(absPath);
      setFolderName(name);
      void getCurrentWebviewWindow().setTitle(`${name} — wyde`);
    } catch {
      setFolderName(absPath);
    }
  }, []);

  const closeFolder = useCallback(() => {
    const fresh = makePane();
    setFolderPath(null);
    setFolderName("");
    setPaneState({ panes: [fresh], focusedPaneId: fresh.id });
    setSplitRatio(DEFAULT_SPLIT_RATIO);
    setBasenamesByPath(new Map());
    editingCountRef.current.clear();
    pendingRefreshRef.current.clear();
    void getCurrentWebviewWindow().setTitle("wyde");
  }, []);

  const pickFolder = useCallback(async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string") void openFolder(picked);
    } catch (e) {
      setError(`open: ${errorMessage(e)}`);
    }
  }, [openFolder]);

  const newWindow = useCallback(() => {
    const label = `wyde-${crypto.randomUUID().slice(0, 8)}`;
    new WebviewWindow(label, {
      url: "/",
      title: "wyde",
      width: 1200,
      height: 800,
      dragDropEnabled: true,
    });
  }, []);

  const onFolderDropped = useCallback(
    (path: string) => {
      void openFolder(path);
    },
    [openFolder]
  );

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => !c);
  }, []);

  const refreshActiveTab = useCallback(() => {
    refreshFolder();
    if (!activePath) return;
    pendingRefreshRef.current.delete(activePath);
    void refreshTab(activePath);
  }, [activePath, refreshTab, refreshFolder]);

  const openFindInFocusedPane = useCallback(() => {
    const id = focusedPaneIdRef.current;
    setPaneSearch((prev) => {
      const cur = prev[id];
      return {
        ...prev,
        [id]: {
          visible: true,
          query: cur?.query ?? "",
          focusBump: (cur?.focusBump ?? 0) + 1,
        },
      };
    });
  }, []);

  const onSearchQueryChange = useCallback((paneId: string, query: string) => {
    setPaneSearch((prev) => {
      const cur = prev[paneId];
      if (!cur) return prev;
      if (cur.query === query) return prev;
      return { ...prev, [paneId]: { ...cur, query } };
    });
  }, []);

  const onSearchClose = useCallback((paneId: string) => {
    setPaneSearch((prev) => {
      const cur = prev[paneId];
      if (!cur || !cur.visible) return prev;
      return { ...prev, [paneId]: { ...cur, visible: false } };
    });
  }, []);

  const openExternalUrl = useCallback((url: string) => {
    void openUrl(url).catch((err) => {
      console.error("openUrl failed:", err);
    });
  }, []);

  // Split divider drag (mouse-based, mirrors Sidebar.tsx pattern).
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const s = splitDragRef.current;
      if (!s) return;
      const fraction = (e.clientX - s.rect.left) / s.rect.width;
      const next = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, fraction));
      setSplitRatio(next);
    }
    function onUp() {
      if (splitDragRef.current) {
        splitDragRef.current = null;
        document.body.classList.remove("resizing");
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startSplitDrag(e: ReactMouseEvent) {
    if (!panesRowRef.current) return;
    e.preventDefault();
    splitDragRef.current = {
      rect: panesRowRef.current.getBoundingClientRect(),
    };
    document.body.classList.add("resizing");
  }

  useDragDropFolder(onFolderDropped);
  useGlobalShortcuts({
    onOpenFolder: pickFolder,
    onNewWindow: newWindow,
    onToggleSidebar: toggleSidebar,
    onRefresh: refreshActiveTab,
    onCloseTab: closeActiveTab,
    onNextTab: nextTab,
    onPrevTab: prevTab,
    onFindInPage: openFindInFocusedPane,
  });
  const zoom = useZoom();

  const activeBasename = activePath ? basenamesByPath.get(activePath) : undefined;
  const isDragInFlight = dragSourcePaneId !== null;
  const sourcePane = dragSourcePaneId
    ? panes.find((p) => p.id === dragSourcePaneId)
    : null;
  const sourceHasMultipleTabs = (sourcePane?.tabs.length ?? 0) > 1;

  const totalOpenTabs = panes.reduce((n, p) => n + p.tabs.length, 0);

  return (
    <div className="app" style={{ zoom }}>
      <header className="topbar">
        {folderPath ? (
          <>
            <button
              type="button"
              className="topbar-action topbar-toggle"
              onClick={toggleSidebar}
              title={
                sidebarCollapsed ? "Show sidebar (⌘B)" : "Hide sidebar (⌘B)"
              }
              aria-label="Toggle sidebar"
            >
              ≡
            </button>
            <button
              type="button"
              className="folder-btn"
              onClick={pickFolder}
              title={folderPath}
            >
              {folderName || folderPath}
            </button>
            <span className="topbar-sep">/</span>
            <span className="filename">{activeBasename ?? "(no file)"}</span>
            {activePath && (
              <button
                type="button"
                className="topbar-action topbar-refresh"
                onClick={refreshActiveTab}
                title="Refresh (⌘R)"
                aria-label="Refresh file from disk"
              >
                ↻
              </button>
            )}
            <button
              type="button"
              className="topbar-action"
              onClick={closeFolder}
            >
              Close
            </button>
          </>
        ) : (
          <span className="filename muted">(no folder)</span>
        )}
        <div className="topbar-spacer" />
        <button type="button" className="topbar-action" onClick={newWindow}>
          New Window
        </button>
        {saveStatus && <span className="save-status">{saveStatus}</span>}
        {error && <span className="error-inline">{error}</span>}
      </header>
      <div className="body">
        {folderPath && !sidebarCollapsed && (
          <Sidebar
            files={files}
            selectedPath={activePath}
            openPaths={openPaths}
            onSelect={onSelectFile}
          />
        )}
        <main className="main">
          {!folderPath ? (
            <div className="content">
              <div className="content-inner">
                <div className="empty-state">
                  <h2>Drag a folder here</h2>
                  <p>or press ⌘O to pick one.</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={pickFolder}
                  >
                    Open Folder…
                  </button>
                  <p className="muted small">⌘N opens a new empty window.</p>
                </div>
              </div>
            </div>
          ) : totalOpenTabs === 0 ? (
            <div className="content">
              <div className="content-inner">
                <div className="empty-state">
                  <p className="muted">no file selected</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="panes-row" ref={panesRowRef}>
              {panes.map((pane, i) => {
                const flex =
                  panes.length === 2
                    ? i === 0
                      ? splitRatio
                      : 1 - splitRatio
                    : 1;
                return (
                  <Fragment key={pane.id}>
                    <div
                      className="pane-slot"
                      style={{ flex: `${flex} 1 0` }}
                    >
                      <Pane
                        pane={pane}
                        basenamesByPath={basenamesByPath}
                        isFocused={pane.id === focusedPaneId}
                        isDragInFlight={isDragInFlight}
                        isDragSource={dragSourcePaneId === pane.id}
                        canSplitSelf={
                          panes.length === 1 && sourceHasMultipleTabs
                        }
                        hoverZone={
                          hoverZone?.paneId === pane.id ? hoverZone.zone : null
                        }
                        searchState={
                          paneSearch[pane.id] ?? {
                            visible: false,
                            query: "",
                            focusBump: 0,
                          }
                        }
                        onSearchQueryChange={onSearchQueryChange}
                        onSearchClose={onSearchClose}
                        onActivateTab={onActivateTab}
                        onCloseTab={onCloseTab}
                        onTabMouseDown={onTabMouseDown}
                        onFocus={focusPane}
                        onSourceCommit={onSourceCommit}
                        onWidthsChange={onWidthsChange}
                        onEditStart={onEditStart}
                        onEditEnd={onEditEnd}
                        onWatcherChange={onWatcherChange}
                        onOpenUrl={openExternalUrl}
                      />
                    </div>
                    {panes.length === 2 && i === 0 && (
                      <div
                        className="split-divider"
                        onMouseDown={startSplitDrag}
                        aria-hidden
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
