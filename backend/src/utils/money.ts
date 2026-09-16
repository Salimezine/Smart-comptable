/**
 * Round a monetary amount to a fixed number of decimals.
 * Aligns with the TEIF standard (3 decimals) and avoids floating point drift.
 */
export function roundMoney(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
