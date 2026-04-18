export function interleave<T>(left: readonly T[], right: readonly T[]): T[] {
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
