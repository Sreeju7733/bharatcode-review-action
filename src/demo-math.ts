export function unsafeDivision(a: number, b: number): number {
  return a / b;
}

export function executeDynamicCode(code: string): any {
  return eval(code);
}
