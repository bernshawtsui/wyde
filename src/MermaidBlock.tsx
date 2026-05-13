import { useCallback, useEffect, useId, useRef, useState } from "react";
import panzoom, { type PanZoom } from "panzoom";

/** Cached mermaid module so we only load it once across all blocks. */
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid(): Promise<typeof import("mermaid").default> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose", // allow links in diagrams
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

interface MermaidBlockProps {
  source: string;
}

/**
 * Renders a `mermaid` fenced code block as an SVG diagram with click-drag
 * panning and zoom (toolbar buttons + ⌘/Ctrl-scroll). The mermaid library
 * (~1.5 MB gzipped) is dynamically imported so files without diagrams
 * don't pay the cost.
 *
 * Re-renders on `source` change with a cancellation flag so a stale
 * render can't clobber a newer one.
 */
export function MermaidBlock({ source }: MermaidBlockProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // React's stable, unique-per-component id. Mermaid uses this as the SVG
  // root id; uniqueness across blocks prevents id collisions when multiple
  // diagrams are on screen at once.
  const reactId = useId();
  const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const pzRef = useRef<PanZoom | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadMermaid()
      .then(async (mermaid) => {
        try {
          const { svg } = await mermaid.render(renderId, source);
          if (!cancelled) setSvg(svg);
        } catch (e) {
          if (!cancelled) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            setSvg(null);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(`failed to load mermaid: ${msg}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, renderId]);

  // Attach panzoom to the rendered SVG. Re-runs when `svg` changes so the
  // instance follows DOM replacement from dangerouslySetInnerHTML.
  useEffect(() => {
    if (!svg) return;
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const pz = panzoom(svgEl as SVGElement, {
      maxZoom: 5,
      minZoom: 0.2,
      bounds: true,
      boundsPadding: 0.2,
      smoothScroll: false,
      zoomDoubleClickSpeed: 1, // disables double-click zoom (reserved for reset)
      // Truthy return tells panzoom to ignore the wheel event and let the
      // browser handle it (page scroll). The .d.ts says `void` but the
      // runtime inspects the return value — cast to satisfy TS.
      beforeWheel: ((e: WheelEvent) =>
        !(e.metaKey || e.ctrlKey)) as (e: WheelEvent) => void,
    });
    pzRef.current = pz;
    return () => {
      pz.dispose();
      pzRef.current = null;
    };
  }, [svg]);

  const zoomBy = useCallback((factor: number) => {
    const pz = pzRef.current;
    const el = containerRef.current?.querySelector("svg");
    if (!pz || !el) return;
    const r = el.getBoundingClientRect();
    pz.smoothZoom(r.left + r.width / 2, r.top + r.height / 2, factor);
  }, []);

  const reset = useCallback(() => {
    const pz = pzRef.current;
    if (!pz) return;
    pz.moveTo(0, 0);
    pz.zoomAbs(0, 0, 1);
  }, []);

  if (error) {
    return (
      <div className="mermaid-error" role="alert">
        <strong>Mermaid error:</strong>
        <pre>{error}</pre>
        <details>
          <summary>Source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return <div className="mermaid-loading">Rendering diagram…</div>;
  }

  return (
    <div ref={containerRef} className="mermaid-block">
      <div className="mermaid-toolbar" aria-label="Diagram controls">
        <button
          type="button"
          onClick={() => zoomBy(0.7)}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={reset}
          title="Reset"
          aria-label="Reset zoom and pan"
        >
          ↺
        </button>
      </div>
      <div
        className="mermaid-svg-host"
        // Mermaid's render output is trusted — it's our own library generating
        // an SVG from user-supplied source. The default `securityLevel: 'loose'`
        // already protects against script injection in diagram syntax.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
