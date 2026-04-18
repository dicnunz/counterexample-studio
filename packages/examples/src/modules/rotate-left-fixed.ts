export function rotateLeft<T>(values: readonly T[], steps: number): T[] {
  if (values.length === 0) {
    return [];
  }
  const normalized = ((steps % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}
