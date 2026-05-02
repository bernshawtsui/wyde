import type { Tab } from "./TabContent";

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
  /** basename per tab path, computed once by the parent. */
  basenames: string[];
  onActivate: (index: number) => void;
  onClose: (index: number) => void;
}

export function TabBar({
  tabs,
  activeIndex,
  basenames,
  onActivate,
  onClose,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`tab${active ? " active" : ""}`}
            onClick={() => onActivate(i)}
            onMouseDown={(e) => {
              // Middle-click closes (browser convention).
              if (e.button === 1) {
                e.preventDefault();
                onClose(i);
              }
            }}
            title={tab.path}
          >
            <span className="tab-name">{basenames[i] ?? tab.path}</span>
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${basenames[i] ?? tab.path}`}
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
