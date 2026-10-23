// The standing fee ruling (James): the 6% service fee appears only at checkout
// (and in the pricing example box). Every surface before checkout shows the
// cleaner's own advertised price. src/lib/pricing/display.test.ts pins this
// against the checkout total.

/** A cleaner's own advertised price, as every pre-checkout surface shows it. */
export function advertisedPrice(cleanerPrice: number): string {
  return cleanerPrice.toFixed(2);
}
