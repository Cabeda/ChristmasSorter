import { describe, expect, it, vi } from "vitest";
import {
  RETRY_STORAGE_KEY,
  RETRY_VERSION,
  parseRetry,
  readRetry,
  removeRetry,
  writeRetry,
  type PendingRetry,
} from "./retry";

const retry: PendingRetry = {
  token: "opaque-token",
  emails: ["ana@example.com", "bia@example.com"],
  count: 2,
};

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => data.set(key, value),
  } as Storage;
}

function brokenStorage(error: Error): Storage {
  return {
    get length() {
      return 0;
    },
    clear: vi.fn(),
    getItem: () => {
      throw error;
    },
    key: () => null,
    removeItem: () => {
      throw error;
    },
    setItem: () => {
      throw error;
    },
  } as unknown as Storage;
}

describe("parseRetry", () => {
  it("returns null when there is no payload", () => {
    expect(parseRetry(null)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseRetry("{nope")).toBeNull();
  });

  it("returns null for another format version", () => {
    expect(
      parseRetry(
        JSON.stringify({ version: RETRY_VERSION + 1, savedAt: 1, ...retry }),
      ),
    ).toBeNull();
  });

  it("returns null for a payload with the wrong shape", () => {
    expect(
      parseRetry(JSON.stringify({ version: RETRY_VERSION, savedAt: "now", ...retry })),
    ).toBeNull();
  });

  it("parses a valid pending retry", () => {
    expect(
      parseRetry(JSON.stringify({ version: RETRY_VERSION, savedAt: 123, ...retry })),
    ).toEqual({ version: RETRY_VERSION, savedAt: 123, ...retry });
  });
});

describe("readRetry", () => {
  it("returns null without storage", () => {
    expect(readRetry(null)).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(readRetry(memoryStorage())).toBeNull();
  });

  it("reads a stored retry", () => {
    const storage = memoryStorage();
    writeRetry(storage, retry);
    expect(readRetry(storage)).toEqual(retry);
  });

  it("ignores an invalid payload", () => {
    const storage = memoryStorage({ [RETRY_STORAGE_KEY]: "{broken" });
    expect(readRetry(storage)).toBeNull();
  });

  it("returns null when storage throws", () => {
    expect(readRetry(brokenStorage(new Error("denied")))).toBeNull();
  });
});

describe("writeRetry", () => {
  it("returns false without storage", () => {
    expect(writeRetry(null, retry)).toBe(false);
  });

  it("stores the version, timestamp, and retry", () => {
    const storage = memoryStorage();
    expect(writeRetry(storage, retry, 123)).toBe(true);

    const stored = JSON.parse(storage.getItem(RETRY_STORAGE_KEY) as string);
    expect(stored).toEqual({ version: RETRY_VERSION, savedAt: 123, ...retry });
  });

  it("defaults the timestamp to now", () => {
    const storage = memoryStorage();
    const before = Date.now();
    writeRetry(storage, retry);
    const stored = JSON.parse(storage.getItem(RETRY_STORAGE_KEY) as string);
    expect(stored.savedAt).toBeGreaterThanOrEqual(before);
  });

  it("reports failure when storage throws", () => {
    expect(writeRetry(brokenStorage(new Error("quota")), retry)).toBe(false);
  });
});

describe("removeRetry", () => {
  it("does not throw without storage", () => {
    expect(() => removeRetry(null)).not.toThrow();
  });

  it("removes the stored retry", () => {
    const storage = memoryStorage();
    writeRetry(storage, retry);
    expect(storage.getItem(RETRY_STORAGE_KEY)).not.toBeNull();

    removeRetry(storage);
    expect(storage.getItem(RETRY_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when storage throws", () => {
    expect(() => removeRetry(brokenStorage(new Error("denied")))).not.toThrow();
  });
});
