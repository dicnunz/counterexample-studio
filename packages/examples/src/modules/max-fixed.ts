export function maxOf(values: readonly number[]): number {
  let current = values[0] as number;
  for (const value of values.slice(1)) {
    if (value > current) {
      current = value;
    }
  }
  return current;
}
