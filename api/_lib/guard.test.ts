import type { VercelRequest } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, RateLimitError } from "./errors";
import {
  SlidingWindowRateLimiter,
  assertAllowedOrigin,
  clientKey,
  enforceRateLimit,
  resetRateLimiter,
} from "./guard";

function makeRequest(init: {
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string } | undefined;
}): VercelRequest {
  return {
    headers: init.headers ?? {},
    socket: init.socket,
  } as unknown as VercelRequest;
}

const ORIGINAL_ALLOWED = process.env.ALLOWED_ORIGINS;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  delete process.env.ALLOWED_ORIGINS;
  process.env.NODE_ENV = "test";
  resetRateLimiter();
});

afterEach(() => {
  if (ORIGINAL_ALLOWED === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = ORIGINAL_ALLOWED;
  if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW_MS;
  resetRateLimiter();
  vi.useRealTimers();
});

describe("SlidingWindowRateLimiter", () => {
  it("allows up to the limit and then blocks with a retry delay", () => {
    const limiter = new SlidingWindowRateLimiter(2, 10_000);
    expect(limiter.check("key", 1000)).toEqual({ allowed: true, retryAfter: 0 });
    expect(limiter.check("key", 2000)).toEqual({ allowed: true, retryAfter: 0 });
    const blocked = limiter.check("key", 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(8);
  });

  it("forgets hits outside the window", () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    expect(limiter.check("key", 1000).allowed).toBe(true);
    expect(limiter.check("key", 1500).allowed).toBe(false);
    expect(limiter.check("key", 2500).allowed).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    const limiter = new SlidingWindowRateLimiter(1, 10_000);
    expect(limiter.check("a", 1000).allowed).toBe(true);
    expect(limiter.check("b", 1000).allowed).toBe(true);
  });

  it("resets every bucket", () => {
    const limiter = new SlidingWindowRateLimiter(1, 10_000);
    limiter.check("a", 1000);
    limiter.reset();
    expect(limiter.check("a", 1000).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("takes the first forwarded hop from a string", () => {
    expect(
      clientKey(makeRequest({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })),
    ).toBe("1.2.3.4");
  });

  it("takes the first forwarded hop from an array", () => {
    expect(
      clientKey(makeRequest({ headers: { "x-forwarded-for": ["9.9.9.9"] } })),
    ).toBe("9.9.9.9");
  });

  it("falls back to the socket address", () => {
    expect(clientKey(makeRequest({ socket: { remoteAddress: "10.0.0.1" } }))).toBe("10.0.0.1");
  });

  it("falls back to the socket when the forwarded header is empty", () => {
    expect(
      clientKey(
        makeRequest({ headers: { "x-forwarded-for": "  " }, socket: { remoteAddress: "10.0.0.2" } }),
      ),
    ).toBe("10.0.0.2");
  });

  it("falls back to the socket when the socket has no address", () => {
    expect(clientKey(makeRequest({ socket: {} }))).toBe("unknown");
  });

  it("returns unknown when there is no socket", () => {
    expect(clientKey(makeRequest({}))).toBe("unknown");
  });
});

describe("assertAllowedOrigin", () => {
  it("accepts an origin in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = "https://a.example, https://b.example";
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://a.example" } })),
    ).not.toThrow();
  });

  it("rejects an origin outside ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = "https://a.example";
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://c.example" } })),
    ).toThrow(ForbiddenError);
  });

  it("rejects a missing origin when ALLOWED_ORIGINS is set", () => {
    process.env.ALLOWED_ORIGINS = "https://a.example";
    expect(() => assertAllowedOrigin(makeRequest({}))).toThrow(ForbiddenError);
  });

  it("rejects a missing origin in production", () => {
    process.env.NODE_ENV = "production";
    expect(() => assertAllowedOrigin(makeRequest({}))).toThrow(ForbiddenError);
  });

  it("allows a missing origin outside production", () => {
    expect(() => assertAllowedOrigin(makeRequest({}))).not.toThrow();
  });

  it("allows an empty origin outside production", () => {
    expect(() => assertAllowedOrigin(makeRequest({ headers: { origin: "" } }))).not.toThrow();
  });

  it("rejects an unparseable origin", () => {
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "not a url", host: "a.example" } })),
    ).toThrow(ForbiddenError);
  });

  it("accepts a same-host origin", () => {
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://a.example", host: "a.example" } })),
    ).not.toThrow();
  });

  it("rejects a cross-host origin", () => {
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://a.example", host: "b.example" } })),
    ).toThrow(ForbiddenError);
  });

  it("rejects an empty host", () => {
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://a.example", host: "" } })),
    ).toThrow(ForbiddenError);
  });

  it("rejects a missing host", () => {
    expect(() =>
      assertAllowedOrigin(makeRequest({ headers: { origin: "https://a.example" } })),
    ).toThrow(ForbiddenError);
  });
});

describe("enforceRateLimit", () => {
  it("throws once the per-IP limit is reached", () => {
    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "10000";
    resetRateLimiter();
    const request = makeRequest({ headers: { "x-forwarded-for": "1.1.1.1" } });
    expect(() => enforceRateLimit(request, "email")).not.toThrow();
    expect(() => enforceRateLimit(request, "email")).not.toThrow();
    expect(() => enforceRateLimit(request, "email")).toThrow(RateLimitError);
  });

  it("keeps endpoints independent", () => {
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "10000";
    resetRateLimiter();
    const request = makeRequest({ headers: { "x-forwarded-for": "2.2.2.2" } });
    expect(() => enforceRateLimit(request, "email")).not.toThrow();
    expect(() => enforceRateLimit(request, "retry")).not.toThrow();
  });

  it("allows a caller again after the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "1000";
    resetRateLimiter();
    const request = makeRequest({ headers: { "x-forwarded-for": "3.3.3.3" } });
    expect(() => enforceRateLimit(request, "email")).not.toThrow();
    expect(() => enforceRateLimit(request, "email")).toThrow(RateLimitError);
    vi.advanceTimersByTime(1500);
    expect(() => enforceRateLimit(request, "email")).not.toThrow();
  });
});
