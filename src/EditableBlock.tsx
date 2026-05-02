import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  createElement,
  useEffect,
  useRef,
  useState,
} from "react";

interface MdNodePosition {
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  children?: ReadonlyArray<{ type?: string; tagName?: string }>;
}

export type EditableBlockTag =
  | "p"
  | "li"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

export interface EditableBlockProps {
  node?: MdNodePosition;
  source: string;
  as: EditableBlockTag;
  multiline?: boolean;
  onCommit: (startOffset: number, endOffset: number, newSource: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  children?: ReactNode;
}

/**
 * Click-to-edit wrapper for top-level block elements (paragraphs, ATX
 * headings, list items). Mirrors the lifecycle of `EditableCell` but
 * activates on **double-click** so single-click text selection and link
 * navigation still work normally.
 *
 * Falls back to a plain element (no edit affordance) when:
 *  - the source slice isn't an ATX heading (`#`-prefixed) and `as` is `h*`
 *  - a list item contains a sublist (editing the outer item would expose
 *    the nested list source, which surprises users)
 *  - mdast position offsets are missing
 */
export function EditableBlock({
  node,
  source,
  as,
  multiline = true,
  onCommit,
  onEditStart,
  onEditEnd,
  children,
}: EditableBlockProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);
  const editStartedRef = useRef(false);

  const startOffset = node?.position?.start?.offset;
  const endOffset = node?.position?.end?.offset;
  const hasOffsets = startOffset != null && endOffset != null;

  const sourceSlice = hasOffsets ? source.slice(startOffset, endOffset) : "";
  const isHeading = as.startsWith("h");
  const isAtx = sourceSlice.startsWith("#");
  const isSetext = isHeading && !isAtx;
  const hasSublist =
    as === "li" &&
    Array.isArray(node?.children) &&
    node.children.some((c) => c.tagName === "ul" || c.tagName === "ol");
  const editable = hasOffsets && !isSetext && !hasSublist;

  useEffect(() => {
    if (!editing) return;
    const el = multiline ? textareaRef.current : inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing, multiline]);

  // If the block unmounts mid-edit (e.g. file refresh) release the lock so
  // deferred refreshes can proceed.
  useEffect(() => {
    return () => {
      if (editStartedRef.current) {
        editStartedRef.current = false;
        onEditEnd?.();
      }
    };
  }, [onEditEnd]);

  function startEdit(e: ReactMouseEvent) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setValue(sourceSlice);
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
    finishEditMode();
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (!hasOffsets) return;
    if (value === sourceSlice) return;
    onCommit(startOffset, endOffset, value);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelledRef.current = true;
      blurActive();
      return;
    }
    if (e.key === "Enter") {
      if (!multiline) {
        e.preventDefault();
        blurActive();
      } else if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        blurActive();
      }
    }
  }

  function blurActive() {
    (multiline ? textareaRef.current : inputRef.current)?.blur();
  }

  if (editing) {
    const editor = multiline ? (
      <textarea
        ref={textareaRef}
        className="block-editor block-editor-multi"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        rows={Math.max(2, value.split("\n").length)}
      />
    ) : (
      <input
        ref={inputRef}
        className="block-editor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    );
    return createElement(as, { className: "editable-block editing" }, editor);
  }

  if (!editable) {
    return createElement(as, null, children);
  }

  return createElement(
    as,
    { className: "editable-block", onDoubleClick: startEdit },
    children
  );
}
