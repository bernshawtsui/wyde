import { useMemo } from "react";
import { tokenizeSql } from "./lib/sqlHighlight";

interface CodeViewProps {
  /** Non-markdown tab kind. `binary` shows a placeholder instead of content. */
  kind: "sql" | "text" | "binary";
  /** Raw file text. Empty for binary files. */
  source: string;
  /** Absolute path — used only to name the file in the binary placeholder. */
  path: string;
}

/**
 * Renders a non-markdown file. Text and SQL are shown verbatim in a
 * preformatted block (SQL with lightweight syntax coloring); binary files get
 * a friendly "can't display" placeholder. The outer `.content` element that
 * hosts this (in TabContent) is what find-in-page searches, so the raw text
 * here is searchable for free.
 */
export function CodeView({ kind, source, path }: CodeViewProps) {
  const sqlTokens = useMemo(
    () => (kind === "sql" ? tokenizeSql(source) : null),
    [kind, source]
  );

  if (kind === "binary") {
    const name = path.slice(path.lastIndexOf("/") + 1) || path;
    return (
      <div className="raw-binary">
        <p className="raw-binary-title">Can’t display “{name}”</p>
        <p className="muted">
          This file isn’t UTF-8 text (it looks binary). Open it in another app
          to view it.
        </p>
      </div>
    );
  }

  return (
    <pre className={kind === "sql" ? "code-view code-view-sql" : "code-view"}>
      <code>
        {sqlTokens
          ? sqlTokens.map((t, i) =>
              t.type === "plain" ? (
                t.value
              ) : (
                <span key={i} className={`tok tok-${t.type}`}>
                  {t.value}
                </span>
              )
            )
          : source}
      </code>
    </pre>
  );
}
