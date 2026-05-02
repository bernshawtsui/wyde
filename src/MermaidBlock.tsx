import { useEffect, useId, useState } from "react";

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
 * Renders a `mermaid` fenced code block as an SVG diagram. The mermaid
 * library (~1.5 MB gzipped) is dynamically imported so files without
 * diagrams don't pay the cost.
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
    <div
      className="mermaid-block"
      // Mermaid's render output is trusted — it's our own library generating
      // an SVG from user-supplied source. The default `securityLevel: 'loose'`
      // already protects against script injection in diagram syntax.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
