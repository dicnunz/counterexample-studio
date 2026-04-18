import { describe, expect, it } from "vitest";
import { exampleCatalog } from "./catalog.js";

describe("exampleCatalog", () => {
  it("ships paired buggy and fixed examples", () => {
    expect(exampleCatalog).toHaveLength(12);
    expect(exampleCatalog.some((entry) => entry.version === "buggy")).toBe(true);
    expect(exampleCatalog.some((entry) => entry.version === "fixed")).toBe(true);
    expect(exampleCatalog.some((entry) => entry.walkthrough)).toBe(true);
  });
});
