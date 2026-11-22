const SYMBOLS: Record<string, string> = {
  euro: "€",
  eur: "€",
  dollar: "$",
  usd: "$",
  pound: "£",
  gbp: "£",
};

/**
 * Turn a currency code (the form sends "euro"/"dollar"/"pound") into the
 * symbol shown in emails and the confirmation modal. Unknown values are
 * passed through so a custom symbol or code still renders sensibly.
 *
 * @param currency Currency code, symbol, or empty value.
 * @returns A symbol, the trimmed input, or "€" as the default.
 */
export function currencySymbol(currency: string | null | undefined): string {
  if (currency === null || currency === undefined) return "€";
  const trimmed = currency.trim();
  if (trimmed === "") return "€";
  return SYMBOLS[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Render a gift price with its resolved currency symbol.
 *
 * @param price Numeric price (a string is accepted because the form keeps it as text).
 * @param currency Currency code or symbol.
 * @returns Example: `5€`.
 */
export function formatGiftPrice(
  price: string | number,
  currency?: string | null,
): string {
  return `${price}${currencySymbol(currency)}`;
}
