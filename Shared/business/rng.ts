/** A function returning a number in [0, 1). */
export type Rng = () => number;

/**
 * Deterministic PRNG (mulberry32). The same seed always yields the same
 * sequence, which keeps draws reproducible in tests and support cases.
 *
 * @param seed 32-bit seed.
 * @returns A pseudo-random number generator.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seed taken from the platform CSPRNG when available, otherwise from
 * `Math.random`. The draw itself is seeded so it can be reproduced.
 *
 * @returns A 32-bit unsigned integer.
 */
export function randomSeed(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return buffer[0]!;
  }
  return Math.floor(Math.random() * 0xffffffff);
}
