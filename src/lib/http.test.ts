import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REQUEST_TIMEOUT_MS, RequestTimeoutError, fetchWithTimeout } from "./http";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("returns the response and keeps the caller's init", async () => {
    const response = { ok: true } as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithTimeout("/api/email", { method: "POST" })).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/email",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }),
    );
  });

  it("aborts a hung request and reports a timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchWithTimeout("/api/email", {}, 1000);
    const rejection = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
  });

  it("re-throws a non-abort failure unchanged", async () => {
    const failure = new Error("network down");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));

    await expect(fetchWithTimeout("/api/email")).rejects.toBe(failure);
  });

  it("exposes a default timeout beyond the server budget", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeGreaterThan(50_000);
  });
});
