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

// Stub panzoom — happy-dom can't run the real lib's SVG transform math, and
// we don't need to verify panzoom's internals here, only that it's invoked.
// vi.mock is hoisted above const declarations; panzoom is statically imported
// in MermaidBlock.tsx, so the mock factory runs before the test file body.
// vi.hoisted() lifts the mock-fn creation up to match.
const { panzoomMock, pzDispose, pzMoveTo, pzZoomAbs, pzSmoothZoom } = vi.hoisted(
  () => {
    const pzDispose = vi.fn();
    const pzMoveTo = vi.fn();
    const pzZoomAbs = vi.fn();
    const pzSmoothZoom = vi.fn();
    const panzoomMock = vi.fn(() => ({
      dispose: pzDispose,
      moveTo: pzMoveTo,
      zoomAbs: pzZoomAbs,
      smoothZoom: pzSmoothZoom,
    }));
    return { panzoomMock, pzDispose, pzMoveTo, pzZoomAbs, pzSmoothZoom };
  }
);

vi.mock("panzoom", () => ({
  default: panzoomMock,
}));

describe("MermaidBlock", () => {
  beforeEach(() => {
    renderMock.mockClear();
    initializeMock.mockClear();
    panzoomMock.mockClear();
    pzDispose.mockClear();
    pzMoveTo.mockClear();
    pzZoomAbs.mockClear();
    pzSmoothZoom.mockClear();
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

  it("attaches panzoom to the rendered SVG and disposes on unmount", async () => {
    const { unmount, container } = render(
      <MermaidBlock source={"graph TD\nA-->B"} />
    );
    await waitFor(() => {
      expect(container.querySelector(".mermaid-block svg")).not.toBeNull();
    });
    expect(panzoomMock).toHaveBeenCalledTimes(1);
    expect(pzDispose).not.toHaveBeenCalled();
    unmount();
    expect(pzDispose).toHaveBeenCalledTimes(1);
  });

  it("toolbar buttons call panzoom zoom and reset", async () => {
    render(<MermaidBlock source={"graph TD\nA-->B"} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Zoom in")).toBeInTheDocument()
    );
    screen.getByLabelText("Zoom in").click();
    expect(pzSmoothZoom).toHaveBeenCalledTimes(1);
    screen.getByLabelText("Zoom out").click();
    expect(pzSmoothZoom).toHaveBeenCalledTimes(2);
    screen.getByLabelText("Reset zoom and pan").click();
    expect(pzMoveTo).toHaveBeenCalledTimes(1);
    expect(pzZoomAbs).toHaveBeenCalledTimes(1);
  });
});
