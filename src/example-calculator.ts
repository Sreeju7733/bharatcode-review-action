// Sample calculation utility for demonstration review
export function divideNumbers(a: number, b: number): number {
  // Bug: No check for division by zero
  return a / b;
}

export function parseUserInput(input: string): any {
  // Security vulnerability: eval used on untrusted user input
  return eval(input);
}

export function computeDiscount(price: number, discount: number): number {
  if (discount > 1) {
    // Logic bug: applying discount greater than 100% inappropriately
    return price * discount;
  }
  return price - (price * discount);
}
