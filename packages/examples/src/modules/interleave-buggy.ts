export function interleave<T>(left: readonly T[], right: readonly T[]): T[] {
  const result: T[] = [];
  let index = 0;
  while (index < left.length && index < right.length) {
    result.push(left[index] as T, right[index] as T);
    index += 1;
  }
  return result;
}
