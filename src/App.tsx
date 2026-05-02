import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { basename } from "@tauri-apps/api/path";
import {
  WebviewWindow,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TabContent, type Tab } from "./TabContent";
import { type MarkdownFile, readFile, writeFile } from "./fs";
import { useDragDropFolder } from "./hooks/useDragDropFolder";
import { useFolderFiles } from "./hooks/useFolderFiles";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useZoom } from "./hooks/useZoom";
import { errorMessage } from "./lib/error";

export default function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { files, error: filesError } = useFolderFiles(folderPath);

  // Per-path edit/refresh tracking (replaces the old single-document refs).
  const editingCountRef = useRef<Map<string, number>>(new Map());
  const pendingRefreshRef = useRef<Set<string>>(new Set());
  const tabsRef = useRef<Tab[]>([]);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    if (filesError) setError(filesError);
  }, [filesError]);

  const activeTab: Tab | undefined = tabs[activeTabIndex];
  const activePath = activeTab?.path ?? null;

  const openPaths = useMemo(() => new Set(tabs.map((t) => t.path)), [tabs]);

  // Tab basenames for display in TabBar (resolved async via Tauri's path lib).
  const [basenames, setBasenames] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(tabs.map((t) => basename(t.path).catch(() => t.path))).then(
      (names) => {
        if (!cancelled) setBasenames(names);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [tabs]);

  const updateTab = useCallback((path: string, mutator: (t: Tab) => Tab) => {
    setTabs((prev) => prev.map((t) => (t.path === path ? mutator(t) : t)));
  }, []);

  const refreshTab = useCallback(async (path: string) => {
    try {
      const text = await readFile(path);
      // Look up the latest tab state at apply time (in case tabs changed).
      setTabs((prev) =>
        prev.map((t) => (t.path === path ? { ...t, source: text } : t))
      );
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
    // If already open, just activate.
    const existing = tabsRef.current.findIndex((t) => t.path === path);
    if (existing !== -1) {
      setActiveTabIndex(existing);
      return;
    }
    try {
      const text = await readFile(path);
      const newTab: Tab = {
        path,
        source: text,
        widthsByTableOffset: {},
      };
      setTabs((prev) => {
        const next = [...prev, newTab];
        // Activate the newly added tab using its post-insertion index.
        setActiveTabIndex(next.length - 1);
        return next;
      });
    } catch (e) {
      setError(`load: ${errorMessage(e)}`);
    }
  }, []);

  const closeTab = useCallback((index: number) => {
    setTabs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Recompute active index relative to closed position.
      setActiveTabIndex((cur) => {
        if (next.length === 0) return 0;
        if (index < cur) return cur - 1;
        if (index === cur) return Math.max(0, Math.min(cur, next.length - 1));
        return cur;
      });
      // Drop per-path tracking for the closed file.
      const closed = prev[index];
      if (closed) {
        editingCountRef.current.delete(closed.path);
        pendingRefreshRef.current.delete(closed.path);
      }
      return next;
    });
  }, []);

  const closeActiveTab = useCallback(() => {
    if (tabsRef.current.length === 0) return;
    closeTab(activeTabIndex);
  }, [activeTabIndex, closeTab]);

  const nextTab = useCallback(() => {
    if (tabsRef.current.length < 2) return;
    setActiveTabIndex((i) => (i + 1) % tabsRef.current.length);
  }, []);

  const prevTab = useCallback(() => {
    if (tabsRef.current.length < 2) return;
    setActiveTabIndex(
      (i) => (i - 1 + tabsRef.current.length) % tabsRef.current.length
    );
  }, []);

  const onSelectFile = useCallback(
    (path: string) => {
      void openTab(path);
    },
    [openTab]
  );

  // Auto-pick test.md or first file when the folder loads / changes.
  useEffect(() => {
    if (!folderPath) return;
    if (files.length === 0) {
      setTabs([]);
      setActiveTabIndex(0);
      return;
    }
    // Only auto-pick when there are no tabs yet (fresh folder open).
    if (tabsRef.current.length > 0) return;
    const test = files.find((f) => f.name === "test.md");
    const first = test ?? files[0];
    void openTab(first.path);
  }, [files, folderPath, openTab]);

  const openFolder = useCallback(async (absPath: string) => {
    // New folder: drop existing tabs, clear edit/refresh tracking.
    setTabs([]);
    setActiveTabIndex(0);
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
    setFolderPath(null);
    setFolderName("");
    setTabs([]);
    setActiveTabIndex(0);
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
    if (!activePath) return;
    pendingRefreshRef.current.delete(activePath);
    void refreshTab(activePath);
  }, [activePath, refreshTab]);

  const openExternalUrl = useCallback((url: string) => {
    void openUrl(url).catch((err) => {
      console.error("openUrl failed:", err);
    });
  }, []);

  useDragDropFolder(onFolderDropped);
  useGlobalShortcuts({
    onOpenFolder: pickFolder,
    onNewWindow: newWindow,
    onToggleSidebar: toggleSidebar,
    onRefresh: refreshActiveTab,
    onCloseTab: closeActiveTab,
    onNextTab: nextTab,
    onPrevTab: prevTab,
  });
  const zoom = useZoom();

  const activeBasename = activeTab ? basenames[activeTabIndex] : undefined;

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
          {folderPath && tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeIndex={activeTabIndex}
              basenames={basenames}
              onActivate={setActiveTabIndex}
              onClose={closeTab}
            />
          )}
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
          ) : tabs.length === 0 ? (
            <div className="content">
              <div className="content-inner">
                <div className="empty-state">
                  <p className="muted">no file selected</p>
                </div>
              </div>
            </div>
          ) : (
            tabs.map((tab, i) => (
              <TabContent
                key={tab.path}
                tab={tab}
                isActive={i === activeTabIndex}
                onSourceCommit={onSourceCommit}
                onWidthsChange={onWidthsChange}
                onEditStart={onEditStart}
                onEditEnd={onEditEnd}
                onWatcherChange={onWatcherChange}
                onOpenUrl={openExternalUrl}
              />
            ))
          )}
        </main>
      </div>
    </div>
  );
}

// MarkdownFile is referenced indirectly via Sidebar; keep the type import alive.
export type { MarkdownFile };
