import { useEffect, useState } from "react";
import { listMarkdownFiles, type MarkdownFile } from "../fs";
import { errorMessage } from "../lib/error";

interface FolderFilesState {
  files: MarkdownFile[];
  error: string | null;
}

/**
 * Recursively list all `.md` files under `folderPath`. Returns the current
 * list and any walk error. Re-runs whenever `folderPath` changes; in-flight
 * walks for an old folder are discarded by a cancellation flag.
 */
export function useFolderFiles(folderPath: string | null): FolderFilesState {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderPath) {
      setFiles([]);
      setError(null);
      return;
    }
    let cancelled = false;
    listMarkdownFiles(folderPath)
      .then((list) => {
        if (cancelled) return;
        setFiles(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(`files: ${errorMessage(e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  return { files, error };
}
