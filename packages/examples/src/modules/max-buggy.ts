export function maxOf(values: readonly number[]): number {
  return values.reduce((current, next) => Math.max(current, next), 0);
}
