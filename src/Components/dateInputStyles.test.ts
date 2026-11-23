import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard for the iOS date-input fix.
 *
 * iOS WebKit gives `<input type="date">` a MenulistButton appearance and then
 * rewrites its box model: a min-width floor, `box-sizing: content-box`, and a
 * centered value. With `width: 100%` that pushes the field past the card.
 * `appearance: none` makes WebKit skip those adjustments.
 *
 * jsdom has no layout engine and this project has no browser test runner yet
 * (issue #5), so this test locks the CSS contract rather than the pixels.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/Components/RegistrationForm.module.css"),
  "utf8",
);

type Rule = { selectors: string[]; body: string };

const rules: Rule[] = [];
for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, selectors = "", body = ""] = match;
  rules.push({
    selectors: selectors
      .trim()
      .split(",")
      .map((selector) => selector.trim()),
    body,
  });
}

const dateInput = rules.find((rule) =>
  rule.selectors.some((selector) =>
    /\.input\[type=["']date["']\]$/.test(selector),
  ),
);

const dateValue = rules.find((rule) =>
  rule.selectors.some((selector) =>
    selector.endsWith("::-webkit-date-and-time-value"),
  ),
);

describe("date input styling for iOS", () => {
  it("opts the date field out of the iOS native appearance", () => {
    expect(dateInput).toBeDefined();
    expect(dateInput?.body).toMatch(/-webkit-appearance:\s*none/);
    expect(dateInput?.body).toMatch(/(^|;|\s)appearance:\s*none/);
  });

  it("keeps the date field inside its container", () => {
    expect(dateInput?.body).toMatch(/max-width:\s*100%/);
    expect(dateInput?.body).toMatch(/box-sizing:\s*border-box/);
  });

  it("left-aligns the value that iOS centers itself", () => {
    expect(dateValue).toBeDefined();
    expect(dateValue?.body).toMatch(/text-align:\s*left/);
    expect(dateValue?.body).toMatch(/min-height:/);
  });
});
