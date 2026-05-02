import { type Frontmatter, type FrontmatterValue } from "./frontmatter";

interface PropertiesProps {
  fm: Frontmatter;
  onOpenUrl: (url: string) => void;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^(https?:|mailto:|file:)/i;
const WIKILINK = /^\[\[(.+)\]\]$/;

/**
 * Read-only Obsidian-style properties panel. Renders YAML frontmatter as
 * key/value rows: arrays become chips, the `tags` key gets purple chips,
 * ISO dates get reformatted as DD/MM/YYYY, URLs become links (driven by
 * the parent's `onOpenUrl`, which already handles ⌘+click semantics).
 */
export function Properties({ fm, onOpenUrl }: PropertiesProps) {
  const entries = Object.entries(fm);
  if (entries.length === 0) return null;

  return (
    <section className="properties-panel">
      <div className="properties-header">Properties</div>
      <div className="properties-grid">
        {entries.map(([key, value]) => (
          <div key={key} className="property-row">
            <div className="property-key">{key}</div>
            <div className="property-value">
              <Value fieldKey={key} value={value} onOpenUrl={onOpenUrl} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ValueProps {
  fieldKey: string;
  value: FrontmatterValue;
  onOpenUrl: (url: string) => void;
}

function Value({ fieldKey, value, onOpenUrl }: ValueProps) {
  if (value == null) return <span className="property-empty">—</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="property-empty">—</span>;
    const chipClass =
      fieldKey === "tags" ? "property-chip property-chip-tag" : "property-chip";
    return (
      <span className="property-chips">
        {value.map((item, i) => (
          <span key={i} className={chipClass}>
            <ScalarText value={item} onOpenUrl={onOpenUrl} />
          </span>
        ))}
      </span>
    );
  }

  if (typeof value === "object") {
    return <code className="property-json">{JSON.stringify(value)}</code>;
  }

  return <ScalarText value={value} onOpenUrl={onOpenUrl} />;
}

interface ScalarTextProps {
  value: FrontmatterValue;
  onOpenUrl: (url: string) => void;
}

function ScalarText({ value, onOpenUrl }: ScalarTextProps) {
  if (value == null) return <>—</>;

  if (typeof value === "boolean" || typeof value === "number") {
    return <>{String(value)}</>;
  }

  if (Array.isArray(value) || typeof value === "object") {
    return <>{JSON.stringify(value)}</>;
  }

  // string
  const wikilink = value.match(WIKILINK);
  if (wikilink) {
    return <span className="property-wikilink">{wikilink[1]}</span>;
  }

  if (URL_PATTERN.test(value)) {
    return (
      <a
        href={value}
        className="property-url"
        onClick={(e) => {
          e.preventDefault();
          if (e.metaKey) {
            e.stopPropagation();
            onOpenUrl(value);
          }
        }}
      >
        {value}
      </a>
    );
  }

  if (ISO_DATE.test(value)) {
    return <>{formatIsoDate(value)}</>;
  }

  return <>{value}</>;
}

function formatIsoDate(iso: string): string {
  // 2026-04-11 → 11/04/2026 (matches the screenshot's locale)
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
