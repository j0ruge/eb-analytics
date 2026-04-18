/**
 * Median with stable tie-break: for an even-length array the lower-middle
 * element of the sorted input is returned (not the arithmetic mean).
 * Matches Aggregation Rules §3.
 */
export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median() requires at least one value');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid]!;
}
