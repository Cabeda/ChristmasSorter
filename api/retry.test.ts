import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./retry";
import { sealToken, type TokenPayload } from "./_lib/token";
import { createTransporter, sendAssignmentEmails } from "./_lib/mail";
import { resetRateLimiter } from "./_lib/guard";

vi.mock("./_lib/mail.js", () => ({
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
  const headers: Record<string, string> = { host: "localhost" };
  if (overrides.origin !== null) headers.origin = overrides.origin ?? "http://localhost";
  headers["x-forwarded-for"] = overrides.ip ?? `10.1.0.${(ipCounter += 1)}`;
  return {
    method: overrides.method ?? "POST",
    headers,
    body: overrides.body,
    socket: {},
  } as unknown as VercelRequest;
}

function makePayload(): TokenPayload {
  return {
    runId: "run-1",
    event: {
      name: "Amigo Secreto",
      date: "2026-12-25T00:00:00.000Z",
      giftPrice: "5",
      currency: "euro",
    },
    assignments: [
      {
        from: { name: "A", email: "a@example.com" },
        to: { name: "B", email: "b@example.com" },
      },
      {
        from: { name: "B", email: "b@example.com" },
        to: { name: "A", email: "a@example.com" },
      },
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
  vi.mocked(sendAssignmentEmails).mockResolvedValue({ sent: 1, failed: [] });
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

describe("POST /api/retry", () => {
  it("rejects non-POST methods", async () => {
    const response = await call(makeRequest({ method: "PUT" }));
    expect(response.statusCode).toBe(405);
  });

  it("resends only the requested recipients", async () => {
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["A@example.com"] } }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      runId: "run-1",
      sent: 1,
      failedCount: 0,
      failures: [],
    });

    const sentAssignments = vi.mocked(sendAssignmentEmails).mock.calls[0]![2];
    expect(sentAssignments).toHaveLength(1);
    expect(sentAssignments[0]!.from.email).toBe("a@example.com");
  });

  it("accepts a raw JSON string body", async () => {
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: JSON.stringify({ token, emails: ["a@example.com"] }) }),
    );
    expect(response.statusCode).toBe(200);
  });

  it("reports a partial retry failure", async () => {
    vi.mocked(sendAssignmentEmails).mockResolvedValue({
      sent: 0,
      failed: [{ email: "a@example.com", reason: "still down" }],
    });
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: false,
      sent: 0,
      failedCount: 1,
      failures: [{ email: "a@example.com", reason: "still down" }],
    });
  });

  it("rejects a non-object body", async () => {
    for (const body of [null, [], 42, "null"]) {
      const response = await call(makeRequest({ body }));
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: "Request body must be an object." });
    }
  });

  it("requires a token", async () => {
    for (const body of [{}, { token: "" }, { token: 1, emails: ["a@example.com"] }]) {
      const response = await call(makeRequest({ body }));
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: "A token is required." });
    }
  });

  it("requires a non-empty email list", async () => {
    const token = sealToken(makePayload());
    for (const emails of [undefined, [], "nope"]) {
      const response = await call(makeRequest({ body: { token, emails } }));
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: "A non-empty list of emails is required." });
    }
  });

  it("rejects invalid email entries", async () => {
    const token = sealToken(makePayload());
    for (const email of [1, "", "   "]) {
      const response = await call(makeRequest({ body: { token, emails: [email] } }));
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: "Each email must be a non-empty string." });
    }
  });

  it("rejects emails that are not in the token", async () => {
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["nobody@example.com"] } }),
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "No recipients from this token match the requested emails.",
    });
  });

  it("rejects an invalid token", async () => {
    const response = await call(
      makeRequest({ body: { token: "nope", emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("requires SORTER_SECRET", async () => {
    const token = sealToken(makePayload());
    delete process.env.SORTER_SECRET;
    const response = await call(
      makeRequest({ body: { token, emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "SORTER_SECRET not configured on server." });
  });

  it("requires mail credentials", async () => {
    delete process.env.MAIL_ADDRESS;
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(500);
  });

  it("reports an SMTP configuration failure", async () => {
    vi.mocked(createTransporter).mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("nope")),
    } as unknown as ReturnType<typeof createTransporter>);
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "SMTP configuration invalid." });
  });

  it("returns 500 when sending throws unexpectedly", async () => {
    vi.mocked(sendAssignmentEmails).mockRejectedValue(new Error("kaboom"));
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({ body: { token, emails: ["a@example.com"] } }),
    );
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error." });
  });

  it("rejects a foreign origin", async () => {
    process.env.ALLOWED_ORIGINS = "https://allowed.example";
    const token = sealToken(makePayload());
    const response = await call(
      makeRequest({
        body: { token, emails: ["a@example.com"] },
        origin: "https://evil.example",
      }),
    );
    expect(response.statusCode).toBe(403);
  });

  it("rate limits by client", async () => {
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "10000";
    resetRateLimiter();
    const token = sealToken(makePayload());
    const ip = "192.0.2.20";
    expect(
      (await call(makeRequest({ body: { token, emails: ["a@example.com"] }, ip }))).statusCode,
    ).toBe(200);
    const blocked = await call(makeRequest({ body: { token, emails: ["a@example.com"] }, ip }));
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["Retry-After"]).toEqual(expect.any(String));
  });
});
