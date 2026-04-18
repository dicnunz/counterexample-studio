export function rotateLeft<T>(values: readonly T[], steps: number): T[] {
  if (values.length === 0) {
    return [];
  }
  const divisor = Math.max(1, values.length - 1);
  const normalized = ((steps % divisor) + divisor) % divisor;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}
