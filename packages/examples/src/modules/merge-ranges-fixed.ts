import type { Range } from "../support.js";

export function mergeRanges(ranges: readonly Range[]): Range[] {
  const sorted = [...ranges]
    .map((range) => ({
      start: Math.min(range.start, range.end),
      end: Math.max(range.start, range.end)
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  return sorted.reduce<Range[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(range);
      return merged;
    }
    if (range.start <= previous.end) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, range.end)
      };
      return merged;
    }
    merged.push(range);
    return merged;
  }, []);
}
