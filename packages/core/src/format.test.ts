import { describe, expect, it } from "vitest";
import { buildGenericReproductionSnippet } from "./format.js";

function evaluateSnippet(args: readonly unknown[], functionName = "identity") {
  const snippet = buildGenericReproductionSnippet({ modulePath: "target.ts", functionName, args });
  const body = snippet.split("\n").filter((line) => !line.startsWith("import ") && !line.startsWith("console.log")).join("\n");
  return new Function("targetModule", `${body}\nreturn actual;`)({ [functionName]: (...received: unknown[]) => received });
}

describe("generic reproduction snippets", () => {
  it("executes valid JavaScript for strings, undefined, nested values, and non-identifier exports", () => {
    const args = ["hello world", undefined, { value: 'a "quoted" string', nested: [undefined, null] }];
    expect(evaluateSnippet(args, "not-an-identifier")).toEqual(args);
  });
  it("preserves special numbers and bigints instead of converting display text into code", () => {
    const args = [NaN, Infinity, -Infinity, -0, 123n];
    expect(evaluateSnippet(args)).toEqual(args);
  });
  it("keeps prototype-like property names as own data", () => {
    const input = JSON.parse('{"__proto__":{"value":1}}');
    const actual = evaluateSnippet([input])[0];
    expect(Object.hasOwn(actual, "__proto__")).toBe(true);
    expect(actual).toEqual(input);
  });
  it("uses an explicit CLI fallback for circular, shared, or unsupported values", () => {
    const circular: unknown[] = []; circular.push(circular);
    const shared = {};
    for (const args of [[circular], [shared, shared], [new Map()], [Symbol("token")], [new Array(2)], [Object.freeze({ value: 1 })]]) {
      const snippet = buildGenericReproductionSnippet({ modulePath: "target.ts", functionName: "identity", args });
      expect(snippet).toContain("saved CLI rerun command");
      expect(snippet).not.toContain("const actual");
    }
  });
});
