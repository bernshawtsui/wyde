import { useEffect } from "react";

interface Shortcuts {
  onOpenFolder: () => void;
  onNewWindow: () => void;
  onToggleSidebar: () => void;
}

/**
 * Bind document-level ⌘ shortcuts:
 *   ⌘O — open folder
 *   ⌘N — spawn a new empty window
 *   ⌘B — toggle sidebar (Obsidian / VS Code convention)
 *
 * Each handler preventDefaults so the webview doesn't claim the keystroke.
 */
export function useGlobalShortcuts({
  onOpenFolder,
  onNewWindow,
  onToggleSidebar,
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenFolder, onNewWindow, onToggleSidebar]);
}
