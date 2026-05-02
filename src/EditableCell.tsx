import {
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { rawCellText } from "./markdown-edit";

/**
 * Subset of an mdast node's `position` field that we rely on to locate the
 * cell in the source string. Both offsets are required for editing; if
 * either is missing we render a non-editable `<td>`.
 */
interface MdNodePosition {
  position?: { start?: { offset?: number }; end?: { offset?: number } };
}

type TdProps = ComponentPropsWithoutRef<"td">;

export interface EditableCellProps extends TdProps {
  node?: MdNodePosition;
  source: string;
  onCommit: (cellOffset: number, newValue: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

export function EditableCell({
  node,
  children,
  source,
  onCommit,
  onEditStart,
  onEditEnd,
  ...rest
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const editStartedRef = useRef(false);

  const startOffset = node?.position?.start?.offset;
  const endOffset = node?.position?.end?.offset;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // If the cell unmounts mid-edit (e.g. file refresh) we still need to
  // release the edit lock so deferred refreshes can run.
  useEffect(() => {
    return () => {
      if (editStartedRef.current) {
        editStartedRef.current = false;
        onEditEnd?.();
      }
    };
  }, [onEditEnd]);

  function startEdit(e: ReactMouseEvent<HTMLTableCellElement>) {
    if (startOffset == null || endOffset == null) return;
    e.preventDefault();
    setValue(rawCellText(source, startOffset, endOffset));
    cancelledRef.current = false;
    setEditing(true);
    if (!editStartedRef.current) {
      editStartedRef.current = true;
      onEditStart?.();
    }
  }

  function finishEditMode() {
    setEditing(false);
    if (editStartedRef.current) {
      editStartedRef.current = false;
      onEditEnd?.();
    }
  }

  function onBlur() {
    const initial =
      startOffset != null && endOffset != null
        ? rawCellText(source, startOffset, endOffset)
        : "";
    finishEditMode();
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (startOffset == null) return;
    if (value === initial) return;
    onCommit(startOffset, value);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelledRef.current = true;
      inputRef.current?.blur();
    }
  }

  if (editing) {
    return (
      <td {...rest} className="cell-editing">
        <input
          ref={inputRef}
          className="cell-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      </td>
    );
  }

  return (
    <td {...rest} onClick={startEdit}>
      {children}
    </td>
  );
}
