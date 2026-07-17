import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { FileEntry } from "./fs";

interface SidebarProps {
  files: FileEntry[];
  selectedPath: string | null;
  /** Paths currently open as tabs (subset includes selectedPath when active). */
  openPaths?: ReadonlySet<string>;
  onSelect: (path: string) => void;
}

type FileNode = { kind: "file"; name: string; path: string };
type DirNode = {
  kind: "dir";
  name: string;
  relPath: string;
  children: TreeNode[];
};
type TreeNode = FileNode | DirNode;

function buildTree(files: FileEntry[]): TreeNode[] {
  type DirBuilder = { children: Map<string, DirBuilder | FileNode> };
  const root: DirBuilder = { children: new Map() };

  for (const f of files) {
    const parts = f.name.split("/");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const existing = cur.children.get(seg);
      if (existing && !("path" in existing)) {
        cur = existing;
      } else {
        const next: DirBuilder = { children: new Map() };
        cur.children.set(seg, next);
        cur = next;
      }
    }
    const leafName = parts[parts.length - 1];
    cur.children.set(leafName, { kind: "file", name: leafName, path: f.path });
  }

  function toNodes(b: DirBuilder, prefix: string): TreeNode[] {
    const dirs: DirNode[] = [];
    const fls: FileNode[] = [];
    for (const [name, child] of b.children) {
      if ("path" in child) {
        fls.push(child);
      } else {
        const relPath = prefix ? `${prefix}/${name}` : name;
        dirs.push({
          kind: "dir",
          name,
          relPath,
          children: toNodes(child, relPath),
        });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    fls.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...fls];
  }

  return toNodes(root, "");
}

function collectAncestors(files: FileEntry[], targetPath: string): string[] {
  const f = files.find((x) => x.path === targetPath);
  if (!f) return [];
  const parts = f.name.split("/");
  const out: string[] = [];
  let prefix = "";
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
    out.push(prefix);
  }
  return out;
}

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 140;
const MAX_WIDTH = 600;

export function Sidebar({
  files,
  selectedPath,
  openPaths,
  onSelect,
}: SidebarProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  // Tracks which directories are currently expanded. Default is empty, so all
  // directories start collapsed; the user opens what they want, and the effect
  // below auto-expands ancestors of the selected file.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Auto-expand ancestors of the selected file when selection changes.
  useEffect(() => {
    if (!selectedPath) return;
    const ancestors = collectAncestors(files, selectedPath);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const a of ancestors) {
        if (!next.has(a)) {
          next.add(a);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPath, files]);

  function toggle(relPath: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const s = dragRef.current;
      if (!s) return;
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, s.startWidth + (e.clientX - s.startX))
      );
      setWidth(next);
    }
    function onUp() {
      if (dragRef.current) {
        dragRef.current = null;
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

  function startDrag(e: ReactMouseEvent) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.classList.add("resizing");
  }

  return (
    <aside className="sidebar" style={{ width: `${width}px` }}>
      <div className="sidebar-scroll">
        <div className="sidebar-header">Files</div>
        <div className="file-tree">
          {tree.length === 0 && <div className="empty">no files</div>}
          {tree.map((node) => (
            <TreeItem
              key={nodeKey(node)}
              node={node}
              depth={0}
              expanded={expanded}
              selectedPath={selectedPath}
              openPaths={openPaths}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <div className="sidebar-resize" onMouseDown={startDrag} aria-hidden />
    </aside>
  );
}

function nodeKey(n: TreeNode): string {
  return n.kind === "file" ? `f:${n.path}` : `d:${n.relPath}`;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  openPaths?: ReadonlySet<string>;
  onToggle: (relPath: string) => void;
  onSelect: (path: string) => void;
}

function TreeItem({
  node,
  depth,
  expanded,
  selectedPath,
  openPaths,
  onToggle,
  onSelect,
}: TreeItemProps) {
  const indent = 6 + depth * 14;
  if (node.kind === "file") {
    const isActive = selectedPath === node.path;
    const isOpen = !isActive && (openPaths?.has(node.path) ?? false);
    return (
      <button
        type="button"
        className={`tree-row file-row${
          isActive ? " selected" : isOpen ? " open" : ""
        }`}
        style={{ paddingLeft: `${indent + 14}px` }}
        onClick={() => onSelect(node.path)}
        title={node.path}
      >
        {node.name}
      </button>
    );
  }
  const isExpanded = expanded.has(node.relPath);
  return (
    <>
      <button
        type="button"
        className="tree-row dir-row"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => onToggle(node.relPath)}
      >
        <span className={`chevron${isExpanded ? " open" : ""}`}>▶</span>
        <span className="dir-name">{node.name}</span>
      </button>
      {isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={nodeKey(child)}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedPath={selectedPath}
            openPaths={openPaths}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
