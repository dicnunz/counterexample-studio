import { describe, expect, it } from "vitest";
import { toDisplayPath } from "./path-display.js";

describe("toDisplayPath", () => {
  it("renders cwd-contained absolute paths relative to the repo", () => {
    expect(
      toDisplayPath(
        "/workspace/counterexample-studio/packages/examples/dist/modules/chunk-buggy.js",
        "/workspace/counterexample-studio"
      )
    ).toBe("./packages/examples/dist/modules/chunk-buggy.js");
  });

  it("keeps outside paths relative to the current working directory", () => {
    expect(
      toDisplayPath("/workspace/shared/target.js", "/workspace/counterexample-studio")
    ).toBe("../shared/target.js");
  });

  it("normalizes bare relative paths into explicit local paths", () => {
    expect(toDisplayPath("src/target.properties.ts", "/workspace/counterexample-studio")).toBe(
      "./src/target.properties.ts"
    );
  });
});
