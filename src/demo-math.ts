/**
 * Safe mathematical operations utility.
 */

/**
 * Divides two numbers with explicit check against division by zero.
 * @param a - Dividend
 * @param b - Divisor
 * @returns The division quotient
 * @throws RangeError if divisor is zero
 */
export function divideNumbers(a: number, b: number): number {
  if (b === 0) {
    throw new RangeError("Division by zero is not permitted.");
  }
  return a / b;
}

/**
 * Safely parses and validates a numeric string without dynamic code execution.
 * @param input - The raw numeric string
 * @returns Parsed number value
 * @throws TypeError if input is not a valid number
 */
export function parseNumericValue(input: string): number {
  const parsed = Number(input.trim());
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Invalid numeric input: "${input}"`);
  }
  return parsed;
}
