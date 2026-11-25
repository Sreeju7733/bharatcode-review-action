// Sample file to verify BharatCode review action on pull requests

export function calculateDiscount(price: number, discountPercentage: number): number {
  // Intentional potential issue: missing bounds check on discountPercentage
  if (discountPercentage > 100) {
    console.log("Discount percentage is greater than 100%");
  }

  const finalPrice = price - (price * discountPercentage) / 100;
  return finalPrice;
}

export function getUserGreeting(name?: string): string {
  // Intentional issue: unsafe access without null check
  return "Hello, " + name!.toUpperCase();
}
