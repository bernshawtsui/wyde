import { useEffect, useState } from "react";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1.0;

function clamp(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

/**
 * Per-window zoom level driven by ⌘= / ⌘+ (in), ⌘- / ⌘_ (out), and
 * ⌘0 (reset). Apply the returned value to a container via the CSS `zoom`
 * property — WebKit reflows the layout correctly and click coordinates
 * remain accurate. Session-only, not persisted.
 */
export function useZoom(): number {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => clamp(z + ZOOM_STEP));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => clamp(z - ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return zoom;
}
