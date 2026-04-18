export function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index + size <= values.length; index += size) {
    chunks.push([...values.slice(index, index + size)]);
  }
  return chunks;
}
