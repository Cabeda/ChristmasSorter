import { describe, expect, it } from "vitest";
import { formatEventDate, toDateInputValue } from "./date";

describe("formatEventDate", () => {
  it("formats a valid ISO date in Portuguese", () => {
    const formatted = formatEventDate("2026-12-25T00:00:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("dezembro");
    expect(formatted).toContain("25");
  });

  it("returns invalid input unchanged", () => {
    expect(formatEventDate("not-a-date")).toBe("not-a-date");
  });
});

describe("toDateInputValue", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date(2026, 11, 24, 12))).toBe("2026-12-24");
  });

  it("pads single-digit months and days", () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("returns an empty string for an invalid date", () => {
    expect(toDateInputValue(new Date("nope"))).toBe("");
  });
});
