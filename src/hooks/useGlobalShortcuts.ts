import { useEffect } from "react";

interface Shortcuts {
  onOpenFolder: () => void;
  onNewWindow: () => void;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onCloseTab: () => void;
  onNextTab: () => void;
  onPrevTab: () => void;
}

/**
 * Bind document-level ⌘ shortcuts:
 *   ⌘O — open folder
 *   ⌘N — spawn a new empty window
 *   ⌘B — toggle sidebar (Obsidian / VS Code convention)
 *   ⌘R — re-read the current file from disk (manual refresh)
 *   ⌘W — close the active tab
 *   ⌘⇧] — activate next tab (browser-style)
 *   ⌘⇧[ — activate previous tab
 *
 * Each handler preventDefaults so the webview doesn't claim the keystroke.
 */
export function useGlobalShortcuts({
  onOpenFolder,
  onNewWindow,
  onToggleSidebar,
  onRefresh,
  onCloseTab,
  onNextTab,
  onPrevTab,
}: Shortcuts): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey) return;
      if (e.shiftKey) {
        // ⌘⇧] / ⌘⇧[ — note: on US layout `]` arrives as `]`, but with shift
        // some browsers report `}` instead. Accept either.
        if (e.key === "]" || e.key === "}") {
          e.preventDefault();
          onNextTab();
          return;
        }
        if (e.key === "[" || e.key === "{") {
          e.preventDefault();
          onPrevTab();
          return;
        }
      }
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
      } else if (e.key === "w") {
        e.preventDefault();
        onCloseTab();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onOpenFolder,
    onNewWindow,
    onToggleSidebar,
    onRefresh,
    onCloseTab,
    onNextTab,
    onPrevTab,
  ]);
}
