export interface Range {
  readonly start: number;
  readonly end: number;
}

export function flatten<T>(value: readonly (readonly T[])[]): T[] {
  return value.flatMap((entry) => entry);
}

export function rotateLeftReference<T>(values: readonly T[], steps: number): T[] {
  if (values.length === 0) {
    return [];
  }
  const normalized = ((steps % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

export function interleaveReference<T>(left: readonly T[], right: readonly T[]): T[] {
  const result: T[] = [];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (index < left.length) {
      result.push(left[index] as T);
    }
    if (index < right.length) {
      result.push(right[index] as T);
    }
  }
  return result;
}

export function mergeRangesReference(ranges: readonly Range[]): Range[] {
  if (ranges.length === 0) {
    return [];
  }
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

export function chunkReference<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push([...values.slice(index, index + size)]);
  }
  return chunks;
}
