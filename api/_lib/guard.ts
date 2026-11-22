import type { VercelRequest } from "@vercel/node";
import { ForbiddenError, RateLimitError } from "./errors.js";

const DEFAULT_MAX_REQUESTS = 8;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

/** A sliding-window limiter. One instance per serverless warm container. */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Record a hit and say whether it is allowed.
   *
   * @param key The bucket key (client and endpoint).
   * @param now Current time in milliseconds.
   * @returns Whether the call is allowed and, if not, when to retry.
   */
  check(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0]!;
      const retryAfter = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.hits.set(key, recent);
      return { allowed: false, retryAfter };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfter: 0 };
  }

  /** Drop every bucket. Used by tests and by a fresh cold start. */
  reset(): void {
    this.hits.clear();
  }
}

let limiter: SlidingWindowRateLimiter | undefined;

function getLimiter(): SlidingWindowRateLimiter {
  if (!limiter) {
    limiter = new SlidingWindowRateLimiter(
      Number(process.env.RATE_LIMIT_MAX ?? DEFAULT_MAX_REQUESTS),
      Number(process.env.RATE_LIMIT_WINDOW_MS ?? DEFAULT_WINDOW_MS),
    );
  }
  return limiter;
}

/** Reset the module-level limiter (tests only). */
export function resetRateLimiter(): void {
  limiter = undefined;
}

/**
 * Identify the caller for rate limiting. Prefer the first `x-forwarded-for`
 * hop; fall back to the socket address.
 *
 * @param req The incoming request.
 * @returns A stable key.
 */
export function clientKey(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (first ?? "").split(",")[0]!.trim();
  if (ip !== "") return ip;

  const remote = req.socket?.remoteAddress;
  if (remote) return remote;

  return "unknown";
}

/**
 * Reject a request whose browser origin is not the app itself.
 *
 * When `ALLOWED_ORIGINS` is set (comma separated) it is the whole allow-list.
 * Otherwise the request must come from the same host; in production a missing
 * `Origin` header is rejected so the endpoint cannot be curled freely.
 */
export function assertAllowedOrigin(req: VercelRequest): void {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  const origin = req.headers.origin;

  if (allowed.length > 0) {
    if (typeof origin !== "string" || !allowed.includes(origin)) {
      throw new ForbiddenError();
    }
    return;
  }

  if (typeof origin !== "string" || origin === "") {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenError();
    }
    return;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError();
  }

  const host = req.headers.host;
  if (typeof host !== "string" || host === "" || originHost !== host) {
    throw new ForbiddenError();
  }
}

/**
 * Enforce the sliding-window limit for one endpoint.
 *
 * @param req The incoming request.
 * @param bucket Endpoint name ("email" or "retry").
 * @throws {RateLimitError} When the caller is over the limit.
 */
export function enforceRateLimit(req: VercelRequest, bucket: string): void {
  const result = getLimiter().check(`${bucket}:${clientKey(req)}`);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfter);
  }
}
