import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDocumentSearch } from "./hooks/useDocumentSearch";

interface SearchBarProps {
  paneId: string;
  query: string;
  activeTabPath: string | undefined;
  /** Source of the active tab — triggers a re-scan when it changes. */
  source: string;
  /** The pane-body element; the hook scopes its DOM search to here. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  onChange: (q: string) => void;
  onClose: () => void;
  /** Bumped when ⌘F is pressed while the bar is already open; re-focuses the input. */
  focusBump: number;
}

export function SearchBar({
  paneId,
  query,
  activeTabPath,
  source,
  containerRef,
  onChange,
  onClose,
  focusBump,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { matchCount, currentDisplayIndex, next, prev } = useDocumentSearch({
    paneId,
    containerRef,
    activeTabPath,
    source,
    query,
  });

  // Focus + select on mount and whenever ⌘F is re-pressed.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [focusBump]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      prev();
    }
  }

  const counter =
    query.length === 0
      ? ""
      : matchCount === 0
        ? "no matches"
        : `${currentDisplayIndex} of ${matchCount}`;

  return (
    <div className="search-bar" role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Find in document"
        aria-label="Find in document"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      <span className="count" aria-live="polite">
        {counter}
      </span>
      <button
        type="button"
        onClick={prev}
        disabled={matchCount === 0}
        title="Previous match (Shift+Enter / ↑)"
        aria-label="Previous match"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={next}
        disabled={matchCount === 0}
        title="Next match (Enter / ↓)"
        aria-label="Next match"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close find bar"
      >
        ×
      </button>
    </div>
  );
}
