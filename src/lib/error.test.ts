import { describe, expect, it } from "vitest";
import { errorMessage } from "./error";

describe("errorMessage", () => {
  it("returns the .message of an Error instance", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns the input when it's already a string", () => {
    expect(errorMessage("plain string")).toBe("plain string");
  });

  it("stringifies undefined", () => {
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("stringifies null", () => {
    expect(errorMessage(null)).toBe("null");
  });

  it("stringifies a plain object", () => {
    expect(errorMessage({ foo: 1 })).toBe("[object Object]");
  });

  it("stringifies a number", () => {
    expect(errorMessage(404)).toBe("404");
  });

  it("preserves subclasses of Error", () => {
    class CustomError extends Error {}
    expect(errorMessage(new CustomError("custom"))).toBe("custom");
  });
});
