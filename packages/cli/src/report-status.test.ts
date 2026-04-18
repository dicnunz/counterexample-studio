import { describe, expect, it } from "vitest";
import { reportHasFailures } from "./report-status.js";

describe("reportHasFailures", () => {
  it("returns true when any case fails", () => {
    expect(
      reportHasFailures({
        cases: [
          { status: "pass" },
          { status: "fail" }
        ] as never
      })
    ).toBe(true);
  });

  it("returns false when every case passes", () => {
    expect(
      reportHasFailures({
        cases: [
          { status: "pass" },
          { status: "pass" }
        ] as never
      })
    ).toBe(false);
  });
});
