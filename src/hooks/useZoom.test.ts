import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useZoom } from "./useZoom";

function meta(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, metaKey: true, bubbles: true });
}

function plain(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true });
}

describe("useZoom", () => {
  it("starts at 1.0", () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current).toBe(1);
  });

  it("⌘= and ⌘+ both zoom in by 0.1", () => {
    const { result } = renderHook(() => useZoom());
    act(() => void window.dispatchEvent(meta("=")));
    expect(result.current).toBeCloseTo(1.1, 5);
    act(() => void window.dispatchEvent(meta("+")));
    expect(result.current).toBeCloseTo(1.2, 5);
  });

  it("⌘- and ⌘_ both zoom out by 0.1", () => {
    const { result } = renderHook(() => useZoom());
    act(() => void window.dispatchEvent(meta("-")));
    expect(result.current).toBeCloseTo(0.9, 5);
    act(() => void window.dispatchEvent(meta("_")));
    expect(result.current).toBeCloseTo(0.8, 5);
  });

  it("⌘0 resets to 1.0", () => {
    const { result } = renderHook(() => useZoom());
    act(() => void window.dispatchEvent(meta("=")));
    act(() => void window.dispatchEvent(meta("=")));
    expect(result.current).toBeCloseTo(1.2, 5);
    act(() => void window.dispatchEvent(meta("0")));
    expect(result.current).toBe(1);
  });

  it("clamps at MAX_ZOOM (3.0)", () => {
    const { result } = renderHook(() => useZoom());
    for (let i = 0; i < 50; i++) {
      act(() => void window.dispatchEvent(meta("=")));
    }
    expect(result.current).toBe(3.0);
  });

  it("clamps at MIN_ZOOM (0.5)", () => {
    const { result } = renderHook(() => useZoom());
    for (let i = 0; i < 50; i++) {
      act(() => void window.dispatchEvent(meta("-")));
    }
    expect(result.current).toBe(0.5);
  });

  it("snaps to one decimal — no floating-point drift after many keypresses", () => {
    const { result } = renderHook(() => useZoom());
    for (let i = 0; i < 5; i++) {
      act(() => void window.dispatchEvent(meta("=")));
    }
    // After 5 increments, value should be exactly 1.5, not 1.4999999...
    expect(result.current).toBe(1.5);
  });

  it("ignores keypresses without the meta modifier", () => {
    const { result } = renderHook(() => useZoom());
    act(() => void window.dispatchEvent(plain("=")));
    act(() => void window.dispatchEvent(plain("-")));
    act(() => void window.dispatchEvent(plain("0")));
    expect(result.current).toBe(1);
  });

  it("ignores ⌘+other-keys", () => {
    const { result } = renderHook(() => useZoom());
    act(() => void window.dispatchEvent(meta("a")));
    act(() => void window.dispatchEvent(meta("b")));
    expect(result.current).toBe(1);
  });
});
