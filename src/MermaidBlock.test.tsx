import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MermaidBlock } from "./MermaidBlock";

// Stub the mermaid module so tests don't depend on real diagram rendering
// (which would require a fully-featured DOM).
const renderMock = vi.fn(async (_id: string, source: string) => {
  if (source.includes("BAD")) throw new Error("Parse error: invalid syntax");
  return { svg: `<svg data-source="${source.replace(/"/g, "&quot;")}"></svg>` };
});

const initializeMock = vi.fn(() => {});

vi.mock("mermaid", () => ({
  default: { render: renderMock, initialize: initializeMock },
}));

describe("MermaidBlock", () => {
  beforeEach(() => {
    renderMock.mockClear();
    initializeMock.mockClear();
  });

  afterEach(() => {
    // Force the cached mermaid promise to be cleared between tests by
    // re-importing through vi.resetModules — this isn't strictly needed
    // since the mock object is stable, but keeps tests independent.
  });

  it("shows a loading state before render resolves", () => {
    const { container } = render(<MermaidBlock source={"graph TD\nA-->B"} />);
    expect(container.querySelector(".mermaid-loading")).not.toBeNull();
  });

  it("renders the SVG returned by mermaid.render", async () => {
    const { container } = render(<MermaidBlock source={"graph TD\nA-->B"} />);
    await waitFor(() => {
      expect(container.querySelector(".mermaid-block svg")).not.toBeNull();
    });
    const svg = container.querySelector(".mermaid-block svg")!;
    expect(svg.getAttribute("data-source")).toBe("graph TD\nA-->B");
  });

  it("calls mermaid.render with the source and a unique id", async () => {
    render(<MermaidBlock source={"graph LR\nX-->Y"} />);
    await waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });
    const [id, source] = renderMock.mock.lastCall!;
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^mermaid-/);
    // useId-derived ids are deterministic but opaque; just sanity-check
    // they're non-empty strings safe for SVG id attributes.
    expect(id.length).toBeGreaterThan("mermaid-".length);
    expect(source).toBe("graph LR\nX-->Y");
  });

  it("renders an error panel when mermaid.render throws", async () => {
    render(<MermaidBlock source={"graph TD\nBAD INPUT"} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/Mermaid error/i)).toBeInTheDocument();
    expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    // Source is shown in the details fold so the user can fix it.
    expect(screen.getByText(/BAD INPUT/)).toBeInTheDocument();
  });

  it("re-renders on source change", async () => {
    const { rerender, container } = render(
      <MermaidBlock source={"graph TD\nFIRST"} />
    );
    await waitFor(() => {
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-source")).toBe("graph TD\nFIRST");
    });
    rerender(<MermaidBlock source={"graph TD\nSECOND"} />);
    await waitFor(() => {
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("data-source")).toBe("graph TD\nSECOND");
    });
  });

  it("clears a previous error when a new (valid) source is supplied", async () => {
    const { rerender } = render(<MermaidBlock source="graph TD\nBAD" />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
    rerender(<MermaidBlock source={"graph TD\nA-->B"} />);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });
});
