import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { SearchBar } from "./SearchBar";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import type { Pane as PaneState, DropZone } from "./lib/panes";

interface PaneSearchState {
  visible: boolean;
  query: string;
  focusBump: number;
}

interface PaneProps {
  pane: PaneState;
  basenamesByPath: Map<string, string>;
  isFocused: boolean;
  isDragInFlight: boolean;
  /** True when the in-flight drag started inside this pane. */
  isDragSource: boolean;
  /**
   * True when this pane could split itself if a tab were dropped on its own
   * side zone — i.e., we're in single-pane mode AND the source pane has more
   * than one tab. Used to keep the source pane's left/right drop overlays
   * visible during a drag, which is how the user creates the initial split.
   */
  canSplitSelf: boolean;
  /** Which zone within THIS pane is currently under the cursor (if any). */
  hoverZone: DropZone | null;
  searchState: PaneSearchState;
  onSearchQueryChange: (paneId: string, query: string) => void;
  onSearchClose: (paneId: string) => void;
  onActivateTab: (paneId: string, index: number) => void;
  onCloseTab: (paneId: string, index: number) => void;
  /** Mouse-down on a tab; App promotes to a drag past the movement threshold. */
  onTabMouseDown: (paneId: string, path: string, e: ReactMouseEvent) => void;
  onFocus: (paneId: string) => void;
  // Forwarded to every TabContent in this pane.
  onSourceCommit: (path: string, next: string) => void;
  onWidthsChange: (path: string, tableOffset: number, widths: number[]) => void;
  onEditStart: (path: string) => void;
  onEditEnd: (path: string) => void;
  onWatcherChange: (path: string) => void;
  onOpenUrl: (url: string) => void;
}

export function Pane({
  pane,
  basenamesByPath,
  isFocused,
  isDragInFlight,
  isDragSource,
  canSplitSelf,
  hoverZone,
  searchState,
  onSearchQueryChange,
  onSearchClose,
  onActivateTab,
  onCloseTab,
  onTabMouseDown,
  onFocus,
  onSourceCommit,
  onWidthsChange,
  onEditStart,
  onEditEnd,
  onWatcherChange,
  onOpenUrl,
}: PaneProps) {
  const paneBodyRef = useRef<HTMLDivElement | null>(null);
  const activeTab = pane.tabs[pane.activeIndex];
  // During a drag, each pane is in exactly one of three modes:
  //
  //  - SELF-SPLIT: this pane is the source AND can split itself (single-pane
  //    mode with multiple tabs). Show two side overlays (left/right) — left
  //    vs. right meaningfully differs because it determines which side the
  //    new pane lands on.
  //
  //  - APPEND: this pane is NOT the source. In two-pane mode this means it's
  //    the other pane; the tab will be appended regardless of where in the
  //    pane the user drops, so show ONE big overlay (no left/right split)
  //    to avoid implying a meaningful choice.
  //
  //  - NONE: source pane in two-pane mode (can't drop on self), or source
  //    pane that can't self-split (single-tab source).
  const showSelfSplitOverlays =
    isDragInFlight && isDragSource && canSplitSelf;
  const showAppendOverlay = isDragInFlight && !isDragSource;

  return (
    <div
      className={`pane${isFocused ? " focused" : ""}`}
      onMouseDown={() => onFocus(pane.id)}
    >
      <div className="pane-tabs-wrap">
        <TabBar
          tabs={pane.tabs}
          activeIndex={pane.activeIndex}
          basenames={basenamesByPath}
          paneId={pane.id}
          onActivate={(i) => onActivateTab(pane.id, i)}
          onClose={(i) => onCloseTab(pane.id, i)}
          onTabMouseDown={onTabMouseDown}
        />
      </div>
      <div className="pane-body" ref={paneBodyRef}>
        {searchState.visible && activeTab && (
          <SearchBar
            paneId={pane.id}
            query={searchState.query}
            activeTabPath={activeTab.path}
            source={activeTab.source}
            containerRef={paneBodyRef}
            focusBump={searchState.focusBump}
            onChange={(q) => onSearchQueryChange(pane.id, q)}
            onClose={() => onSearchClose(pane.id)}
          />
        )}
        {pane.tabs.length === 0 ? (
          <div className="content">
            <div className="content-inner">
              <div className="empty-state">
                <p className="muted">no file in this pane</p>
              </div>
            </div>
          </div>
        ) : (
          pane.tabs.map((tab, i) => (
            <TabContent
              key={tab.path}
              tab={tab}
              isActive={i === pane.activeIndex}
              onSourceCommit={onSourceCommit}
              onWidthsChange={onWidthsChange}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              onWatcherChange={onWatcherChange}
              onOpenUrl={onOpenUrl}
            />
          ))
        )}
        {showSelfSplitOverlays && (
          <>
            <div
              className={`drop-zone drop-zone-left${
                hoverZone === "left" ? " active" : ""
              }`}
              data-drop-zone="left"
              data-pane-id={pane.id}
            />
            <div
              className={`drop-zone drop-zone-right${
                hoverZone === "right" ? " active" : ""
              }`}
              data-drop-zone="right"
              data-pane-id={pane.id}
            />
          </>
        )}
      </div>
      {showAppendOverlay && (
        <div
          className={`drop-zone drop-zone-pane${
            hoverZone === "tabs" ? " active" : ""
          }`}
          data-drop-zone="tabs"
          data-pane-id={pane.id}
        />
      )}
    </div>
  );
}
