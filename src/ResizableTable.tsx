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

export function ResizableTable({ children }: { children: ReactNode }) {
  const numCols = useMemo(() => countColumns(children), [children]);
  const [widths, setWidths] = useState<number[]>(() =>
    Array(numCols).fill(DEFAULT_WIDTH)
  );
  const dragState = useRef<{
    col: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    setWidths((prev) =>
      prev.length === numCols ? prev : Array(numCols).fill(DEFAULT_WIDTH)
    );
  }, [numCols]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const s = dragState.current;
      if (!s) return;
      const next = Math.max(MIN_WIDTH, s.startWidth + (e.clientX - s.startX));
      setWidths((w) => {
        if (w[s.col] === next) return w;
        const copy = w.slice();
        copy[s.col] = next;
        return copy;
      });
    }
    function onUp() {
      if (dragState.current) {
        dragState.current = null;
        document.body.classList.remove("resizing");
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startDrag(col: number, e: ReactMouseEvent) {
    e.preventDefault();
    dragState.current = {
      col,
      startX: e.clientX,
      startWidth: widths[col] ?? DEFAULT_WIDTH,
    };
    document.body.classList.add("resizing");
  }

  const offsets = useMemo(() => {
    const out: number[] = [];
    let cum = 0;
    for (const w of widths) {
      cum += w;
      out.push(cum);
    }
    return out;
  }, [widths]);

  if (numCols === 0 || widths.length !== numCols) {
    return <table>{children}</table>;
  }

  return (
    <div className="resizable-table-wrap">
      <table>
        <colgroup>
          {widths.map((w, i) => (
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
