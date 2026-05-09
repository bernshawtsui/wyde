import type { MouseEvent as ReactMouseEvent } from "react";
import type { Tab } from "./TabContent";

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
  /** basename per tab path, looked up by parent. */
  basenames: Map<string, string>;
  /** Stable id of the pane this strip belongs to. */
  paneId: string;
  onActivate: (index: number) => void;
  onClose: (index: number) => void;
  /**
   * Called on left mouse-down. The parent runs the drag protocol (window-level
   * mousemove/mouseup + elementFromPoint hit-testing) because Tauri's
   * `dragDropEnabled: true` disables HTML5 drag in the webview.
   */
  onTabMouseDown?: (
    paneId: string,
    path: string,
    e: ReactMouseEvent
  ) => void;
}

export function TabBar({
  tabs,
  activeIndex,
  basenames,
  paneId,
  onActivate,
  onClose,
  onTabMouseDown,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        const name = basenames.get(tab.path) ?? tab.path;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`tab${active ? " active" : ""}`}
            onClick={() => onActivate(i)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                // Middle-click closes (browser convention).
                e.preventDefault();
                onClose(i);
                return;
              }
              if (e.button === 0) {
                onTabMouseDown?.(paneId, tab.path, e);
              }
            }}
            title={tab.path}
          >
            <span className="tab-name">{name}</span>
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
