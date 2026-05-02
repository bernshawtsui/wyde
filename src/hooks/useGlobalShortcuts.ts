import { useEffect } from "react";

interface Shortcuts {
  onOpenFolder: () => void;
  onNewWindow: () => void;
  onToggleSidebar: () => void;
  onRefresh: () => void;
}

/**
 * Bind document-level ⌘ shortcuts:
 *   ⌘O — open folder
 *   ⌘N — spawn a new empty window
 *   ⌘B — toggle sidebar (Obsidian / VS Code convention)
 *   ⌘R — re-read the current file from disk (manual refresh)
 *
 * Each handler preventDefaults so the webview doesn't claim the keystroke —
 * notably, ⌘R would otherwise reload the entire React app, losing zoom,
 * sidebar state, and any in-flight cell edits.
 */
export function useGlobalShortcuts({
  onOpenFolder,
  onNewWindow,
  onToggleSidebar,
  onRefresh,
}: Shortcuts): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey) return;
      if (e.key === "o") {
        e.preventDefault();
        onOpenFolder();
      } else if (e.key === "n") {
        e.preventDefault();
        onNewWindow();
      } else if (e.key === "b") {
        e.preventDefault();
        onToggleSidebar();
      } else if (e.key === "r") {
        e.preventDefault();
        onRefresh();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenFolder, onNewWindow, onToggleSidebar, onRefresh]);
}
