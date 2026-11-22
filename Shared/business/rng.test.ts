import { afterEach, describe, expect, it, vi } from "vitest";
import { mulberry32, randomSeed } from "./rng";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    const sequence = (rng: () => number) => Array.from({ length: 10 }, () => rng());
    expect(sequence(first)).toEqual(sequence(second));
  });

  it("returns values in [0, 1)", () => {
    const rng = mulberry32(7);
    for (let index = 0; index < 100; index += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("returns different sequences for different seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("randomSeed", () => {
  it("uses getRandomValues when available", () => {
    const getRandomValues = vi.fn((buffer: Uint32Array) => {
      buffer[0] = 123;
      return buffer;
    });
    vi.stubGlobal("crypto", { getRandomValues });
    expect(randomSeed()).toBe(123);
    expect(getRandomValues).toHaveBeenCalled();
  });

  it("falls back to Math.random without a crypto object", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomSeed()).toBe(Math.floor(0.5 * 0xffffffff));
  });

  it("falls back to Math.random when getRandomValues is missing", () => {
    vi.stubGlobal("crypto", {});
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    expect(randomSeed()).toBe(Math.floor(0.25 * 0xffffffff));
  });

  it("returns the buffer value, including zero", () => {
    vi.stubGlobal("crypto", { getRandomValues: (buffer: Uint32Array) => buffer });
    expect(randomSeed()).toBe(0);
  });
});
