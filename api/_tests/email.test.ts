import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../email";
import { openToken } from "../_lib/token";
import { createTransporter, sendAssignmentEmails } from "../_lib/mail";
import { resetRateLimiter } from "../_lib/guard";

vi.mock("../_lib/mail.js", () => ({
  createTransporter: vi.fn(),
  sendAssignmentEmails: vi.fn(),
}));

type FakeResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: (code: number) => FakeResponse;
  json: (payload: unknown) => FakeResponse;
  setHeader: (name: string, value: string) => FakeResponse;
};

function makeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 0,
    body: undefined,
    headers: {},
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(payload) {
      response.body = payload;
      return response;
    },
    setHeader(name, value) {
      response.headers[name] = value;
      return response;
    },
  };
  return response;
}

let ipCounter = 0;

function makeRequest(overrides: {
  method?: string;
  body?: unknown;
  origin?: string | null;
  ip?: string;
}): VercelRequest {
  const headers: Record<string, string> = {
    host: "localhost",
  };
  if (overrides.origin !== null) headers.origin = overrides.origin ?? "http://localhost";
  headers["x-forwarded-for"] = overrides.ip ?? `10.0.0.${(ipCounter += 1)}`;
  return {
    method: overrides.method ?? "POST",
    headers,
    body: overrides.body,
    socket: {},
  } as unknown as VercelRequest;
}

function validBody(): Record<string, unknown> {
  return {
    name: "Amigo Secreto",
    date: "2026-12-25",
    giftPrice: "5",
    currency: "euro",
    participants: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
  };
}

async function call(request: VercelRequest): Promise<FakeResponse> {
  const response = makeResponse();
  await handler(request, response as unknown as VercelResponse);
  return response;
}

beforeEach(() => {
  process.env.MAIL_ADDRESS = "sender@example.com";
  process.env.MAIL_PASSWORD = "secret";
  process.env.SORTER_SECRET = "test-secret";
  process.env.NODE_ENV = "test";
  delete process.env.ALLOWED_ORIGINS;
  resetRateLimiter();
  vi.mocked(createTransporter).mockReturnValue({
    verify: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof createTransporter>);
  vi.mocked(sendAssignmentEmails).mockResolvedValue({ sent: 2, failed: [] });
});

afterEach(() => {
  delete process.env.MAIL_ADDRESS;
  delete process.env.MAIL_PASSWORD;
  delete process.env.SORTER_SECRET;
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW_MS;
  resetRateLimiter();
  vi.clearAllMocks();
});

describe("POST /api/email", () => {
  it("rejects non-POST methods", async () => {
    const response = await call(makeRequest({ method: "GET" }));
    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method not allowed." });
  });

  it("draws and sends without ever returning the pairs", async () => {
    const response = await call(makeRequest({ body: validBody() }));
    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({ success: true, sent: 2, failedCount: 0, failures: [], deduped: 0 });
    expect(body).not.toHaveProperty("assignments");

    const payload = openToken(String(body.token));
    expect(payload.assignments).toHaveLength(2);
    expect(sendAssignmentEmails).toHaveBeenCalledTimes(1);
    expect(createTransporter).toHaveBeenCalledTimes(1);
  });

  it("accepts a raw JSON string body", async () => {
    const response = await call(makeRequest({ body: JSON.stringify(validBody()) }));
    expect(response.statusCode).toBe(200);
  });

  it("rejects a raw body that is not JSON", async () => {
    const response = await call(makeRequest({ body: "{" }));
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "Invalid JSON body." });
  });

  it("reports partial failures and keeps the token for a retry", async () => {
    vi.mocked(sendAssignmentEmails).mockResolvedValue({
      sent: 1,
      failed: [{ email: "a@example.com", reason: "boom" }],
    });
    const response = await call(makeRequest({ body: validBody() }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: false,
      sent: 1,
      failedCount: 1,
      failures: [{ email: "a@example.com", reason: "boom" }],
    });
    expect((response.body as Record<string, unknown>).token).toEqual(expect.any(String));
  });

  it("requires mail credentials", async () => {
    delete process.env.MAIL_ADDRESS;
    const withoutAddress = await call(makeRequest({ body: validBody() }));
    expect(withoutAddress.statusCode).toBe(500);
    expect(withoutAddress.body).toEqual({ error: "Mail credentials not configured on server." });

    delete process.env.MAIL_PASSWORD;
    process.env.MAIL_ADDRESS = "sender@example.com";
    const withoutPassword = await call(makeRequest({ body: validBody() }));
    expect(withoutPassword.statusCode).toBe(500);
  });

  it("requires SORTER_SECRET", async () => {
    delete process.env.SORTER_SECRET;
    const response = await call(makeRequest({ body: validBody() }));
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "SORTER_SECRET not configured on server." });
  });

  it("reports an SMTP configuration failure", async () => {
    vi.mocked(createTransporter).mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("nope")),
    } as unknown as ReturnType<typeof createTransporter>);
    const response = await call(makeRequest({ body: validBody() }));
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "SMTP configuration invalid." });
  });

  it("returns 422 when the draw is impossible", async () => {
    const body = validBody();
    body.participants = [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ];
    body.exclusions = [["a@example.com", "b@example.com"]];
    const response = await call(makeRequest({ body }));
    expect(response.statusCode).toBe(422);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await call(makeRequest({ body: { nope: true } }));
    expect(response.statusCode).toBe(400);
  });

  it("returns 500 when sending throws unexpectedly", async () => {
    vi.mocked(sendAssignmentEmails).mockRejectedValue(new Error("kaboom"));
    const response = await call(makeRequest({ body: validBody() }));
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error." });
  });

  it("rejects a foreign origin", async () => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example";
    const response = await call(
      makeRequest({ body: validBody(), origin: "https://evil.example" }),
    );
    expect(response.statusCode).toBe(403);
  });

  it("rate limits by client", async () => {
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "10000";
    resetRateLimiter();
    const ip = "192.0.2.10";
    expect((await call(makeRequest({ body: validBody(), ip }))).statusCode).toBe(200);
    const blocked = await call(makeRequest({ body: validBody(), ip }));
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["Retry-After"]).toEqual(expect.any(String));
  });
});
