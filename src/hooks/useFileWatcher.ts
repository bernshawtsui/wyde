import { useEffect } from "react";
import { watchPath } from "../fs";

/**
 * Watch `absPath` for changes and invoke `onChange` (debounced inside the
 * Tauri plugin). No-op when `absPath` is null. Cleans up the watcher on
 * unmount or when the path changes.
 */
export function useFileWatcher(
  absPath: string | null,
  onChange: () => void
): void {
  useEffect(() => {
    if (!absPath) return;
    let unwatch: (() => void) | undefined;
    let cancelled = false;
    watchPath(absPath, onChange).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unwatch = fn;
    });
    return () => {
      cancelled = true;
      unwatch?.();
    };
  }, [absPath, onChange]);
}
