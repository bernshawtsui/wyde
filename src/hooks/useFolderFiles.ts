import { useCallback, useEffect, useRef, useState } from "react";
import { listMarkdownFiles, watchFolder, type MarkdownFile } from "../fs";
import { errorMessage } from "../lib/error";

interface FolderFilesState {
  files: MarkdownFile[];
  error: string | null;
  refresh: () => void;
}

function sameFileList(a: MarkdownFile[], b: MarkdownFile[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path) return false;
  }
  return true;
}

/**
 * Recursively list all `.md` files under `folderPath`, and keep the list in
 * sync with the filesystem via a recursive directory watcher. Returns the
 * current list, any walk error, and a `refresh()` to force a manual rescan.
 * Re-runs whenever `folderPath` changes; in-flight walks for an old folder
 * are discarded by a cancellation flag.
 */
export function useFolderFiles(folderPath: string | null): FolderFilesState {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rescanRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!folderPath) {
      setFiles([]);
      setError(null);
      rescanRef.current = () => {};
      return;
    }
    let cancelled = false;
    let unwatch: (() => void) | undefined;

    const rescan = () => {
      listMarkdownFiles(folderPath)
        .then((list) => {
          if (cancelled) return;
          // Skip setState when the path list is identical — saves to an
          // existing file fire the watcher but don't change the listing.
          setFiles((prev) => (sameFileList(prev, list) ? prev : list));
          setError(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setError(`files: ${errorMessage(e)}`);
        });
    };
    rescanRef.current = rescan;

    rescan();
    watchFolder(folderPath, rescan).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unwatch = fn;
    });

    return () => {
      cancelled = true;
      unwatch?.();
      rescanRef.current = () => {};
    };
  }, [folderPath]);

  const refresh = useCallback(() => {
    rescanRef.current();
  }, []);

  return { files, error, refresh };
}
