import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TokenError } from "./errors";
import { newRunId, openToken, sealToken, type TokenPayload } from "./token";

const event = {
  name: "Amigo Secreto",
  date: "2026-12-25T00:00:00.000Z",
  giftPrice: "5",
  currency: "euro",
};

const payload: TokenPayload = {
  runId: "run-1",
  event,
  assignments: [
    {
      from: { name: "A", email: "a@example.com" },
      to: { name: "B", email: "b@example.com" },
    },
  ],
};

beforeEach(() => {
  process.env.SORTER_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.SORTER_SECRET;
});

describe("token", () => {
  it("round-trips a payload", () => {
    const token = sealToken(payload);
    expect(token.startsWith("v1.")).toBe(true);
    expect(openToken(token)).toEqual(payload);
  });

  it("produces a different token every time", () => {
    expect(sealToken(payload)).not.toBe(sealToken(payload));
  });

  it("creates a UUID run id", () => {
    expect(newRunId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("requires a secret to seal", () => {
    delete process.env.SORTER_SECRET;
    expect(() => sealToken(payload)).toThrow("SORTER_SECRET is not configured.");
  });

  it("rejects opening without a secret", () => {
    const token = sealToken(payload);
    delete process.env.SORTER_SECRET;
    expect(() => openToken(token)).toThrow(TokenError);
  });

  it("rejects malformed tokens", () => {
    expect(() => openToken("nope")).toThrow(TokenError);
    expect(() => openToken("v1.a.b")).toThrow(TokenError);
    expect(() => openToken("v2.a.b.c")).toThrow(TokenError);
  });

  it("rejects a tampered token", () => {
    const parts = sealToken(payload).split(".");
    const tag = parts[2]!;
    const tampered = [parts[0], parts[1], `${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`, parts[3]].join(
      ".",
    );
    expect(() => openToken(tampered)).toThrow(TokenError);
  });

  it("rejects a payload that is not an object", () => {
    for (const bad of [null, "string", 42]) {
      const token = sealToken(bad as unknown as TokenPayload);
      expect(() => openToken(token)).toThrow(TokenError);
    }
  });

  it("rejects a payload without assignments", () => {
    const token = sealToken({ runId: "run", event } as unknown as TokenPayload);
    expect(() => openToken(token)).toThrow(TokenError);
  });
});
