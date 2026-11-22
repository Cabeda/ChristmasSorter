import { describe, expect, it } from "vitest";
import { currencySymbol, formatGiftPrice } from "./currency";

describe("currencySymbol", () => {
  it("maps known codes case-insensitively", () => {
    expect(currencySymbol("euro")).toBe("€");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("dollar")).toBe("$");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("pound")).toBe("£");
    expect(currencySymbol("GBP")).toBe("£");
  });

  it("defaults empty values to euro", () => {
    expect(currencySymbol(null)).toBe("€");
    expect(currencySymbol(undefined)).toBe("€");
    expect(currencySymbol("")).toBe("€");
    expect(currencySymbol("   ")).toBe("€");
  });

  it("passes unknown symbols and codes through, trimmed", () => {
    expect(currencySymbol("R$")).toBe("R$");
    expect(currencySymbol("  CHF  ")).toBe("CHF");
  });
});

describe("formatGiftPrice", () => {
  it("appends the resolved symbol", () => {
    expect(formatGiftPrice("5", "euro")).toBe("5€");
    expect(formatGiftPrice(10, "dollar")).toBe("10$");
    expect(formatGiftPrice("7.5")).toBe("7.5€");
  });
});
