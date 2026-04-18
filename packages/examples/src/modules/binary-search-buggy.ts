export function binarySearch(values: readonly number[], target: number): number {
  let left = 0;
  let right = values.length - 1;

  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    const current = values[middle] as number;
    if (current === target) {
      return middle;
    }
    if (current < target) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return -1;
}
