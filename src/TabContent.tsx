import { useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { EditableBlock } from "./EditableBlock";
import { EditableCell } from "./EditableCell";
import { MermaidBlock } from "./MermaidBlock";
import { Properties } from "./Properties";
import { ResizableTable } from "./ResizableTable";
import { extractFrontmatter } from "./frontmatter";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { applyBlockEdit, applyCellEdit } from "./markdown-edit";

export interface Tab {
  /** Absolute file path. Stable identity for the tab. */
  path: string;
  /** Current contents (in-memory; may be ahead of disk during a save). */
  source: string;
  /**
   * Column widths keyed by each table's `position.start.offset` in the
   * current source. Stable across in-table edits; resets to defaults if
   * a block edit shifts a table's offset.
   */
  widthsByTableOffset: Record<number, number[]>;
}

interface TabContentProps {
  tab: Tab;
  isActive: boolean;
  onSourceCommit: (path: string, next: string) => void;
  onWidthsChange: (path: string, tableOffset: number, widths: number[]) => void;
  onEditStart: (path: string) => void;
  onEditEnd: (path: string) => void;
  onWatcherChange: (path: string) => void;
  onOpenUrl: (url: string) => void;
}

/**
 * Renders one open file. Always mounted while the tab exists; uses
 * `display: none` when not active so per-tab state (column widths,
 * scroll position, in-progress cell edits) survives tab switches.
 */
export function TabContent({
  tab,
  isActive,
  onSourceCommit,
  onWidthsChange,
  onEditStart,
  onEditEnd,
  onWatcherChange,
  onOpenUrl,
}: TabContentProps) {
  const onWatcher = useCallback(
    () => onWatcherChange(tab.path),
    [onWatcherChange, tab.path]
  );
  useFileWatcher(tab.path, onWatcher);

  const { fm } = useMemo(() => extractFrontmatter(tab.source), [tab.source]);

  const handleStart = useCallback(
    () => onEditStart(tab.path),
    [onEditStart, tab.path]
  );
  const handleEnd = useCallback(
    () => onEditEnd(tab.path),
    [onEditEnd, tab.path]
  );

  const handleCellCommit = useCallback(
    (cellOffset: number, newValue: string) => {
      const next = applyCellEdit(tab.source, cellOffset, newValue);
      if (next == null || next === tab.source) return;
      onSourceCommit(tab.path, next);
    },
    [tab.path, tab.source, onSourceCommit]
  );

  const handleBlockCommit = useCallback(
    (startOffset: number, endOffset: number, newSource: string) => {
      const next = applyBlockEdit(
        tab.source,
        startOffset,
        endOffset,
        newSource
      );
      if (next === tab.source) return;
      onSourceCommit(tab.path, next);
    },
    [tab.path, tab.source, onSourceCommit]
  );

  return (
    <div
      className="content"
      style={{ display: isActive ? "block" : "none" }}
      data-path={tab.path}
    >
      <div className="content-inner">
        {fm && <Properties fm={fm} onOpenUrl={onOpenUrl} />}
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          components={{
            a: ({ href, children, ...rest }) => (
              <a
                {...rest}
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (e.metaKey && href) {
                    e.stopPropagation();
                    onOpenUrl(href);
                  }
                }}
              >
                {children}
              </a>
            ),
            code: ({ className, children, ...rest }) => {
              // react-markdown gives fenced code blocks a `language-X`
              // class; inline code has no such class. Route mermaid to
              // its own renderer; everything else falls through.
              const langMatch = /language-(\w+)/.exec(className ?? "");
              if (langMatch?.[1] === "mermaid") {
                return (
                  <MermaidBlock
                    source={String(children).replace(/\n$/, "")}
                  />
                );
              }
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
            table: ({ node, children }) => {
              const offset = node?.position?.start.offset ?? 0;
              return (
                <div className="table-wrap">
                  <ResizableTable
                    widths={tab.widthsByTableOffset[offset]}
                    onWidthsChange={(w) => onWidthsChange(tab.path, offset, w)}
                  >
                    {children}
                  </ResizableTable>
                </div>
              );
            },
            td: (props) => (
              <EditableCell
                {...props}
                source={tab.source}
                onCommit={handleCellCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              />
            ),
            p: ({ node, children }) => (
              <EditableBlock
                as="p"
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            li: ({ node, children }) => (
              <EditableBlock
                as="li"
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h1: ({ node, children }) => (
              <EditableBlock
                as="h1"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h2: ({ node, children }) => (
              <EditableBlock
                as="h2"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h3: ({ node, children }) => (
              <EditableBlock
                as="h3"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h4: ({ node, children }) => (
              <EditableBlock
                as="h4"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h5: ({ node, children }) => (
              <EditableBlock
                as="h5"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
            h6: ({ node, children }) => (
              <EditableBlock
                as="h6"
                multiline={false}
                node={node}
                source={tab.source}
                onCommit={handleBlockCommit}
                onEditStart={handleStart}
                onEditEnd={handleEnd}
              >
                {children}
              </EditableBlock>
            ),
          }}
        >
          {tab.source}
        </ReactMarkdown>
      </div>
    </div>
  );
}
