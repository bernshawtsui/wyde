import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { stat } from "@tauri-apps/plugin-fs";

/**
 * Subscribe to native drag-and-drop events for the current window. When the
 * user drops one or more paths, the first directory among them is reported
 * via `onFolderDropped`. Files-only drops are ignored.
 */
export function useDragDropFolder(
  onFolderDropped: (path: string) => void
): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        for (const p of event.payload.paths) {
          try {
            const s = await stat(p);
            if (s.isDirectory) {
              onFolderDropped(p);
              return;
            }
          } catch {
            // Path no longer exists or is unreadable; try the next one.
          }
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onFolderDropped]);
}
