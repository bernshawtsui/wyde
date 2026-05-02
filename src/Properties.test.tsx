import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Properties } from "./Properties";

describe("Properties", () => {
  it("renders nothing for empty frontmatter", () => {
    const { container } = render(<Properties fm={{}} onOpenUrl={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Properties header and key/value rows", () => {
    render(
      <Properties
        fm={{ type: "concept", title: "Hello" }}
        onOpenUrl={() => {}}
      />
    );
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("concept")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("reformats ISO dates as DD/MM/YYYY", () => {
    render(<Properties fm={{ created: "2026-04-11" }} onOpenUrl={() => {}} />);
    expect(screen.getByText("11/04/2026")).toBeInTheDocument();
  });

  it("renders arrays as chips", () => {
    const { container } = render(
      <Properties fm={{ aliases: ["x", "y", "z"] }} onOpenUrl={() => {}} />
    );
    const chips = container.querySelectorAll(".property-chip");
    expect(chips).toHaveLength(3);
    expect(chips[0].textContent).toBe("x");
    expect(chips[2].textContent).toBe("z");
  });

  it("applies the tag-pill class for the `tags` key specifically", () => {
    const { container } = render(
      <Properties
        fm={{ aliases: ["a"], tags: ["consume", "foundational"] }}
        onOpenUrl={() => {}}
      />
    );
    const tagChips = container.querySelectorAll(".property-chip-tag");
    expect(tagChips).toHaveLength(2);
    // aliases chips do NOT get the tag class
    const aliasChip = container.querySelector(
      ".property-chip:not(.property-chip-tag)"
    );
    expect(aliasChip?.textContent).toBe("a");
  });

  it("renders URLs as links and ⌘+click triggers onOpenUrl", async () => {
    const onOpenUrl = vi.fn();
    const user = userEvent.setup();
    render(
      <Properties
        fm={{ docs: "https://example.com/docs" }}
        onOpenUrl={onOpenUrl}
      />
    );
    const link = screen.getByText("https://example.com/docs");
    expect(link.tagName).toBe("A");
    expect(link.className).toContain("property-url");
    // ⌘+click
    await user.keyboard("{Meta>}");
    await user.click(link);
    await user.keyboard("{/Meta}");
    expect(onOpenUrl).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("plain click on a URL does NOT call onOpenUrl", async () => {
    const onOpenUrl = vi.fn();
    const user = userEvent.setup();
    render(
      <Properties
        fm={{ docs: "https://example.com/docs" }}
        onOpenUrl={onOpenUrl}
      />
    );
    await user.click(screen.getByText("https://example.com/docs"));
    expect(onOpenUrl).not.toHaveBeenCalled();
  });

  it("renders mailto links", () => {
    render(
      <Properties
        fm={{ contact: "mailto:hi@example.com" }}
        onOpenUrl={() => {}}
      />
    );
    expect(screen.getByText("mailto:hi@example.com").tagName).toBe("A");
  });

  it("strips brackets from wikilinks and styles them as wikilink", () => {
    const { container } = render(
      <Properties fm={{ source: "[[sources/foo]]" }} onOpenUrl={() => {}} />
    );
    const wl = container.querySelector(".property-wikilink");
    expect(wl).not.toBeNull();
    expect(wl?.textContent).toBe("sources/foo");
  });

  it("renders booleans, numbers, and null reasonably", () => {
    render(
      <Properties
        fm={{ active: true, count: 42, empty: null }}
        onOpenUrl={() => {}}
      />
    );
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    // null renders as the em-dash empty marker
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
