import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 40;

function countColumns(children: ReactNode): number {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type !== "thead") continue;
    for (const row of Children.toArray(child.props.children)) {
      if (!isValidElement<{ children?: ReactNode }>(row)) continue;
      return Children.toArray(row.props.children).filter(isValidElement).length;
    }
  }
  return 0;
}

function defaultWidths(numCols: number): number[] {
  return Array(numCols).fill(DEFAULT_WIDTH);
}

interface ResizableTableProps {
  children: ReactNode;
  /** When undefined, falls back to default widths derived from column count. */
  widths?: number[];
  onWidthsChange: (widths: number[]) => void;
}

/**
 * Controlled `<table>` wrapper with draggable column dividers.
 *
 * Width state lives in the parent (per-tab), so column widths persist
 * across file/tab switches. The component still tracks live drag state
 * internally for smooth real-time updates, but every change is reported
 * up via `onWidthsChange`.
 */
export function ResizableTable({
  children,
  widths,
  onWidthsChange,
}: ResizableTableProps) {
  const numCols = useMemo(() => countColumns(children), [children]);
  const propsWidths =
    widths && widths.length === numCols ? widths : defaultWidths(numCols);

  // Live widths during a drag — local state so 60fps drag updates only
  // re-render this component, not the entire ReactMarkdown tree above it.
  // On mouseup we push the final value up via `onWidthsChange` (one parent
  // re-render per drag instead of one per mousemove).
  const [dragWidths, setDragWidths] = useState<number[] | null>(null);
  const effectiveWidths = dragWidths ?? propsWidths;

  // Refs so the (run-once) listener effect can read the latest values
  // without re-binding on every prop change.
  const propsWidthsRef = useRef(propsWidths);
  propsWidthsRef.current = propsWidths;
  const dragWidthsRef = useRef<number[] | null>(null);
  const onWidthsChangeRef = useRef(onWidthsChange);
  onWidthsChangeRef.current = onWidthsChange;

  const dragState = useRef<{
    col: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const s = dragState.current;
      if (!s) return;
      const next = Math.max(MIN_WIDTH, s.startWidth + (e.clientX - s.startX));
      const base = dragWidthsRef.current ?? propsWidthsRef.current;
      if (base[s.col] === next) return;
      const updated = base.slice();
      updated[s.col] = next;
      dragWidthsRef.current = updated;
      setDragWidths(updated);
    }
    function onUp() {
      if (!dragState.current) return;
      dragState.current = null;
      document.body.classList.remove("resizing");
      // Commit the final widths to the parent exactly once, then clear
      // the local drag state. React batches these two state updates, so
      // there's no flicker between "drag widths" and "props widths".
      const final = dragWidthsRef.current;
      if (final) {
        onWidthsChangeRef.current(final);
        dragWidthsRef.current = null;
        setDragWidths(null);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Defensive: never leave the cursor stuck on `col-resize` if the
      // component unmounts mid-drag.
      document.body.classList.remove("resizing");
    };
  }, []);

  function startDrag(col: number, e: ReactMouseEvent) {
    e.preventDefault();
    dragState.current = {
      col,
      startX: e.clientX,
      startWidth: effectiveWidths[col] ?? DEFAULT_WIDTH,
    };
    document.body.classList.add("resizing");
  }

  const offsets = useMemo(() => {
    const out: number[] = [];
    let cum = 0;
    for (const w of effectiveWidths) {
      cum += w;
      out.push(cum);
    }
    return out;
  }, [effectiveWidths]);

  if (numCols === 0) {
    return <table>{children}</table>;
  }

  return (
    <div className="resizable-table-wrap">
      <table>
        <colgroup>
          {effectiveWidths.map((w, i) => (
            <col key={i} style={{ width: `${w}px` }} />
          ))}
        </colgroup>
        {children}
      </table>
      {offsets.map((off, i) => (
        <div
          key={i}
          className="resize-handle"
          style={{ left: `${off}px` }}
          onMouseDown={(e) => startDrag(i, e)}
          aria-hidden
        />
      ))}
    </div>
  );
}
