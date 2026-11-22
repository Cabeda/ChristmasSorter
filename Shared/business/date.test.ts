import { describe, expect, it } from "vitest";
import { formatEventDate } from "./date";

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
