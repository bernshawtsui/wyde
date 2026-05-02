import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

// `vi.fn(() => {})` infers the call signature as `() => void`, which is
// what `useGlobalShortcuts` expects. Bare `vi.fn()` in vitest 4 returns
// a constructable mock that doesn't satisfy `() => void`.
const noop = () => {};

function setup() {
  const handlers = {
    onOpenFolder: vi.fn(noop),
    onNewWindow: vi.fn(noop),
    onToggleSidebar: vi.fn(noop),
    onRefresh: vi.fn(noop),
    onCloseTab: vi.fn(noop),
    onNextTab: vi.fn(noop),
    onPrevTab: vi.fn(noop),
  };
  renderHook(() => useGlobalShortcuts(handlers));
  return handlers;
}

function dispatch(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    key,
    metaKey: true,
    cancelable: true,
    bubbles: true,
    ...options,
  });
  window.dispatchEvent(e);
  return e;
}

describe("useGlobalShortcuts", () => {
  it("⌘O calls onOpenFolder and preventDefaults", () => {
    const h = setup();
    const e = dispatch("o");
    expect(h.onOpenFolder).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it("⌘N calls onNewWindow", () => {
    const h = setup();
    dispatch("n");
    expect(h.onNewWindow).toHaveBeenCalledTimes(1);
  });

  it("⌘B calls onToggleSidebar", () => {
    const h = setup();
    dispatch("b");
    expect(h.onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("⌘R calls onRefresh", () => {
    const h = setup();
    dispatch("r");
    expect(h.onRefresh).toHaveBeenCalledTimes(1);
  });

  it("⌘W calls onCloseTab", () => {
    const h = setup();
    dispatch("w");
    expect(h.onCloseTab).toHaveBeenCalledTimes(1);
  });

  it("⌘⇧] and ⌘⇧} both call onNextTab", () => {
    const h = setup();
    dispatch("]", { shiftKey: true });
    dispatch("}", { shiftKey: true });
    expect(h.onNextTab).toHaveBeenCalledTimes(2);
  });

  it("⌘⇧[ and ⌘⇧{ both call onPrevTab", () => {
    const h = setup();
    dispatch("[", { shiftKey: true });
    dispatch("{", { shiftKey: true });
    expect(h.onPrevTab).toHaveBeenCalledTimes(2);
  });

  it("ignores keypresses without the meta modifier", () => {
    const h = setup();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "o" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    expect(h.onOpenFolder).not.toHaveBeenCalled();
    expect(h.onNewWindow).not.toHaveBeenCalled();
  });

  it("ignores ⌘+other-keys (e.g. ⌘a, ⌘x)", () => {
    const h = setup();
    dispatch("a");
    dispatch("x");
    expect(h.onOpenFolder).not.toHaveBeenCalled();
    expect(h.onCloseTab).not.toHaveBeenCalled();
  });

  it("⌘⇧] does NOT also fire ⌘W or other handlers", () => {
    const h = setup();
    dispatch("]", { shiftKey: true });
    expect(h.onNextTab).toHaveBeenCalledTimes(1);
    expect(h.onCloseTab).not.toHaveBeenCalled();
    expect(h.onOpenFolder).not.toHaveBeenCalled();
  });
});
