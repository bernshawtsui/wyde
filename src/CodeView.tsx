import { useMemo } from "react";
import { tokenizeSql, type SqlToken } from "./lib/sqlHighlight";
import { tokenizeYaml, type YamlToken } from "./lib/yamlHighlight";

/** Kinds that get syntax coloring (and, with it, the dark code panel). */
const HIGHLIGHTED = new Set(["sql", "yaml"]);

interface CodeViewProps {
  /** Non-markdown tab kind. `binary` shows a placeholder instead of content. */
  kind: "sql" | "yaml" | "text" | "binary";
  /** Raw file text. Empty for binary files. */
  source: string;
  /** Absolute path — used only to name the file in the binary placeholder. */
  path: string;
}

/**
 * Renders a non-markdown file. Text is shown verbatim in a preformatted
 * block; SQL and YAML additionally get lightweight syntax coloring in a
 * fixed dark panel; binary files get a friendly "can't display" placeholder.
 * The outer `.content` element that hosts this (in TabContent) is what
 * find-in-page searches, so the raw text here is searchable for free.
 */
export function CodeView({ kind, source, path }: CodeViewProps) {
  const tokens: (SqlToken | YamlToken)[] | null = useMemo(() => {
    if (kind === "sql") return tokenizeSql(source);
    if (kind === "yaml") return tokenizeYaml(source);
    return null;
  }, [kind, source]);

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

  const className = HIGHLIGHTED.has(kind)
    ? `code-view code-view-${kind}`
    : "code-view";

  return (
    <pre className={className}>
      <code>
        {tokens
          ? tokens.map((t, i) =>
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
