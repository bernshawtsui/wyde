import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { basename } from "@tauri-apps/api/path";
import {
  WebviewWindow,
  getCurrentWebviewWindow,
} from "@tauri-apps/api/webviewWindow";
import { EditableBlock } from "./EditableBlock";
import { EditableCell } from "./EditableCell";
import { Properties } from "./Properties";
import { ResizableTable } from "./ResizableTable";
import { Sidebar } from "./Sidebar";
import { extractFrontmatter } from "./frontmatter";
import { type MarkdownFile, readFile, writeFile } from "./fs";
import { useDragDropFolder } from "./hooks/useDragDropFolder";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useFolderFiles } from "./hooks/useFolderFiles";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useZoom } from "./hooks/useZoom";
import { errorMessage } from "./lib/error";
import { applyBlockEdit, applyCellEdit } from "./markdown-edit";

export default function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { fm } = useMemo(() => extractFrontmatter(source), [source]);

  const { files, error: filesError } = useFolderFiles(folderPath);

  const sourceRef = useRef<string>("");
  const editingCountRef = useRef(0);
  const pendingRefreshRef = useRef(false);
  const selectedPathRef = useRef<string | null>(null);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);
  useEffect(() => {
    if (filesError) setError(filesError);
  }, [filesError]);

  const fetchFile = useCallback(async (filePath: string) => {
    try {
      const text = await readFile(filePath);
      if (selectedPathRef.current !== filePath) return;
      setSource(text);
      sourceRef.current = text;
      setError(null);
    } catch (e) {
      setError(`load: ${errorMessage(e)}`);
    }
  }, []);

  const maybeRefresh = useCallback(() => {
    if (!pendingRefreshRef.current) return;
    if (editingCountRef.current > 0) return;
    const f = selectedPathRef.current;
    if (!f) return;
    pendingRefreshRef.current = false;
    void fetchFile(f);
  }, [fetchFile]);

  const onWatcherChange = useCallback(() => {
    pendingRefreshRef.current = true;
    maybeRefresh();
  }, [maybeRefresh]);

  useFileWatcher(selectedPath, onWatcherChange);

  // Auto-pick test.md or first file when the folder loads / changes.
  useEffect(() => {
    if (files.length === 0) {
      setSelectedPath(null);
      return;
    }
    setSelectedPath((current) => {
      if (current && files.some((f) => f.path === current)) return current;
      const test = files.find((f) => f.name === "test.md");
      return (test ?? files[0]).path;
    });
  }, [files]);

  // Fetch contents on file selection
  useEffect(() => {
    if (!selectedPath) {
      setSource("");
      sourceRef.current = "";
      return;
    }
    void fetchFile(selectedPath);
  }, [selectedPath, fetchFile]);

  const openFolder = useCallback(async (absPath: string) => {
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
    setSelectedPath(null);
    setSource("");
    sourceRef.current = "";
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

  const refreshCurrentFile = useCallback(() => {
    const f = selectedPathRef.current;
    if (!f) return;
    // Bypass the deferred-refresh / editing-count gate; user is explicitly
    // asking for a re-read right now.
    pendingRefreshRef.current = false;
    void fetchFile(f);
  }, [fetchFile]);

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
    onRefresh: refreshCurrentFile,
  });
  const zoom = useZoom();

  const handleEditStart = useCallback(() => {
    editingCountRef.current += 1;
  }, []);

  const handleEditEnd = useCallback(() => {
    editingCountRef.current = Math.max(0, editingCountRef.current - 1);
    if (editingCountRef.current === 0) maybeRefresh();
  }, [maybeRefresh]);

  const persistSource = useCallback(async (next: string) => {
    const f = selectedPathRef.current;
    if (!f) return;
    setSource(next);
    sourceRef.current = next;
    setSaveStatus("saving…");
    try {
      await writeFile(f, next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1200);
    } catch (e) {
      setSaveStatus("");
      setError(`save: ${errorMessage(e)}`);
    }
  }, []);

  const handleCommit = useCallback(
    async (cellOffset: number, newValue: string) => {
      const current = sourceRef.current;
      const next = applyCellEdit(current, cellOffset, newValue);
      if (next == null || next === current) return;
      await persistSource(next);
    },
    [persistSource]
  );

  const handleBlockCommit = useCallback(
    async (startOffset: number, endOffset: number, newSource: string) => {
      const current = sourceRef.current;
      const next = applyBlockEdit(current, startOffset, endOffset, newSource);
      if (next === current) return;
      await persistSource(next);
    },
    [persistSource]
  );

  const selectedName = files.find(
    (f: MarkdownFile) => f.path === selectedPath
  )?.name;

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
            <span className="filename">{selectedName ?? "(no file)"}</span>
            {selectedPath && (
              <button
                type="button"
                className="topbar-action topbar-refresh"
                onClick={refreshCurrentFile}
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
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        )}
        <main className="content">
          <div className="content-inner">
            {!folderPath ? (
              <div className="empty-state">
                <h2>Drag a folder here</h2>
                <p>or press ⌘O to pick one.</p>
                <button type="button" className="primary" onClick={pickFolder}>
                  Open Folder…
                </button>
                <p className="muted small">⌘N opens a new empty window.</p>
              </div>
            ) : selectedPath ? (
              <>
                {fm && <Properties fm={fm} onOpenUrl={openExternalUrl} />}
                <ReactMarkdown
                  key={selectedPath}
                  remarkPlugins={[remarkGfm, remarkFrontmatter]}
                  components={{
                    a: ({ href, children, ...rest }) => (
                      <a
                        {...rest}
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          if (e.metaKey && href) {
                            e.stopPropagation();
                            void openUrl(href).catch((err) => {
                              console.error("openUrl failed:", err);
                            });
                          }
                        }}
                      >
                        {children}
                      </a>
                    ),
                    table: (props) => (
                      <div className="table-wrap">
                        <ResizableTable>{props.children}</ResizableTable>
                      </div>
                    ),
                    td: (props) => (
                      <EditableCell
                        {...props}
                        source={source}
                        onCommit={handleCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      />
                    ),
                    p: ({ node, children }) => (
                      <EditableBlock
                        as="p"
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    li: ({ node, children }) => (
                      <EditableBlock
                        as="li"
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h1: ({ node, children }) => (
                      <EditableBlock
                        as="h1"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h2: ({ node, children }) => (
                      <EditableBlock
                        as="h2"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h3: ({ node, children }) => (
                      <EditableBlock
                        as="h3"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h4: ({ node, children }) => (
                      <EditableBlock
                        as="h4"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h5: ({ node, children }) => (
                      <EditableBlock
                        as="h5"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                    h6: ({ node, children }) => (
                      <EditableBlock
                        as="h6"
                        multiline={false}
                        node={node}
                        source={source}
                        onCommit={handleBlockCommit}
                        onEditStart={handleEditStart}
                        onEditEnd={handleEditEnd}
                      >
                        {children}
                      </EditableBlock>
                    ),
                  }}
                >
                  {source}
                </ReactMarkdown>
              </>
            ) : (
              <div className="empty-state">
                <p className="muted">no file selected</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
