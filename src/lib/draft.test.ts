import { describe, expect, it, vi } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  DRAFT_VERSION,
  parseDraft,
  readDraft,
  removeDraft,
  toDraftValues,
  writeDraft,
  type DraftValues,
} from "./draft";
import { DEFAULT_VALUES } from "./formModel";

const values: DraftValues = {
  eventName: "Natal 2026",
  eventDate: "2026-12-24",
  price: "25",
  currency: "euro",
  participants: [
    { name: "Ana", email: "ana@example.com" },
    { name: "Bia", email: "bia@example.com" },
  ],
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

describe("toDraftValues", () => {
  it("keeps every field from a complete form", () => {
    expect(toDraftValues(values)).toEqual(values);
  });

  it("fills missing fields with empty strings", () => {
    expect(toDraftValues({})).toEqual({
      eventName: "",
      eventDate: "",
      price: "",
      currency: "",
      participants: [],
    });
  });

  it("fills missing participant fields", () => {
    expect(
      toDraftValues({ participants: [{ name: "Ana" }, undefined, {}] }),
    ).toEqual({
      eventName: "",
      eventDate: "",
      price: "",
      currency: "",
      participants: [
        { name: "Ana", email: "" },
        { name: "", email: "" },
        { name: "", email: "" },
      ],
    });
  });
});

describe("parseDraft", () => {
  it("returns null when there is no payload", () => {
    expect(parseDraft(null)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseDraft("{nope")).toBeNull();
  });

  it("returns null for another draft version", () => {
    expect(
      parseDraft(JSON.stringify({ version: DRAFT_VERSION + 1, savedAt: 1, values })),
    ).toBeNull();
  });

  it("returns null for a payload with the wrong shape", () => {
    expect(parseDraft(JSON.stringify({ version: DRAFT_VERSION, savedAt: "now" }))).toBeNull();
  });

  it("parses a valid draft", () => {
    expect(parseDraft(writePayload(values))).toEqual({
      version: DRAFT_VERSION,
      savedAt: 123,
      values,
    });
  });

  function writePayload(draftValues: DraftValues): string {
    return JSON.stringify({ version: DRAFT_VERSION, savedAt: 123, values: draftValues });
  }
});

describe("readDraft", () => {
  it("returns null when nothing is stored", () => {
    expect(readDraft(memoryStorage())).toBeNull();
  });

  it("reads a stored draft", () => {
    const storage = memoryStorage();
    writeDraft(storage, values);
    expect(readDraft(storage)?.values).toEqual(values);
  });

  it("returns null when storage throws", () => {
    expect(readDraft(brokenStorage(new Error("denied")))).toBeNull();
  });
});

describe("writeDraft", () => {
  it("stores the version, timestamp, and values", () => {
    const storage = memoryStorage();
    expect(writeDraft(storage, values, 123)).toBe(true);

    const stored = JSON.parse(storage.getItem(DRAFT_STORAGE_KEY) as string);
    expect(stored).toEqual({ version: DRAFT_VERSION, savedAt: 123, values });
  });

  it("defaults the timestamp to now", () => {
    const storage = memoryStorage();
    const before = Date.now();
    writeDraft(storage, values);
    const stored = JSON.parse(storage.getItem(DRAFT_STORAGE_KEY) as string);
    expect(stored.savedAt).toBeGreaterThanOrEqual(before);
  });

  it("reports failure when storage throws", () => {
    expect(writeDraft(brokenStorage(new Error("quota")), values)).toBe(false);
  });
});

describe("removeDraft", () => {
  it("removes the stored draft", () => {
    const storage = memoryStorage();
    writeDraft(storage, values);
    expect(storage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();

    removeDraft(storage);
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when storage throws", () => {
    expect(() => removeDraft(brokenStorage(new Error("denied")))).not.toThrow();
  });
});

describe("default form model", () => {
  it("starts with two empty participants and a valid date", () => {
    expect(DEFAULT_VALUES.participants).toHaveLength(2);
    expect(DEFAULT_VALUES.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
