import { z } from "zod";

/** Versioned key, so a future retry format can ship without reading this one. */
export const RETRY_STORAGE_KEY = "christmas-sorter:retry:v1";
export const RETRY_VERSION = 1;

const RetryPayloadSchema = z.object({
  version: z.literal(RETRY_VERSION),
  savedAt: z.number(),
  token: z.string().min(1),
  emails: z.array(z.string()).min(1),
  count: z.number().int().positive(),
});

/** The retry a partial send leaves behind: opaque token plus the failed inboxes. */
export interface PendingRetry {
  token: string;
  emails: string[];
  count: number;
}

export interface StoredRetry extends PendingRetry {
  version: number;
  savedAt: number;
}

/** Parse a stored payload, returning `null` for anything corrupt or old. */
export function parseRetry(raw: string | null): StoredRetry | null {
  if (raw === null) return null;
  try {
    const result = RetryPayloadSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Read the pending retry, tolerating disabled or throwing storage. */
export function readRetry(storage: Storage | null): PendingRetry | null {
  if (storage === null) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(RETRY_STORAGE_KEY);
  } catch {
    return null;
  }

  const stored = parseRetry(raw);
  if (stored === null) return null;
  return { token: stored.token, emails: stored.emails, count: stored.count };
}

/** Persist a pending retry and report whether the storage write happened. */
export function writeRetry(
  storage: Storage | null,
  retry: PendingRetry,
  savedAt = Date.now(),
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(
      RETRY_STORAGE_KEY,
      JSON.stringify({ version: RETRY_VERSION, savedAt, ...retry }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Remove the pending retry, tolerating disabled or throwing storage. */
export function removeRetry(storage: Storage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(RETRY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, quota, policy). The form still works.
  }
}
