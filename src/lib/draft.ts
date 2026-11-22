import { z } from "zod";
import type { FormInputs, ParticipantInput } from "./formModel";

/** Versioned key, so a future draft format can ship without reading this one. */
export const DRAFT_STORAGE_KEY = "christmas-sorter:draft:v1";
export const DRAFT_VERSION = 1;
/** One keystroke burst should not hit localStorage on every keypress. */
export const DRAFT_DEBOUNCE_MS = 300;

const DraftValuesSchema = z.object({
  eventName: z.string(),
  eventDate: z.string(),
  price: z.string(),
  currency: z.string(),
  participants: z.array(z.object({ name: z.string(), email: z.string() })),
});

const DraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  savedAt: z.number(),
  values: DraftValuesSchema,
});

export type DraftValues = z.infer<typeof DraftValuesSchema>;
export type Draft = z.infer<typeof DraftSchema>;

/** The shape `watch()` emits: every field may be missing while the user types. */
type DraftSource = Partial<Omit<FormInputs, "participants">> & {
  participants?: Array<Partial<ParticipantInput> | undefined>;
};

/**
 * Normalize possibly-partial form values into a serializable draft. Missing
 * fields become empty strings rather than `undefined`, so a restored form is
 * always controlled.
 */
export function toDraftValues(values: DraftSource): DraftValues {
  return {
    eventName: values.eventName ?? "",
    eventDate: values.eventDate ?? "",
    price: values.price ?? "",
    currency: values.currency ?? "",
    participants: (values.participants ?? []).map((participant) => ({
      name: participant?.name ?? "",
      email: participant?.email ?? "",
    })),
  };
}

/** Parse a stored payload, returning `null` for anything corrupt or old. */
export function parseDraft(raw: string | null): Draft | null {
  if (raw === null) return null;
  try {
    const result = DraftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Access `localStorage` without throwing. Browsers can deny the property
 * itself (blocked cookies, sandboxed iframes), not just individual calls.
 */
export function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read the current draft, tolerating disabled or throwing storage. */
export function readDraft(storage: Storage | null): Draft | null {
  if (storage === null) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const draft = parseDraft(raw);
  if (draft === null) removeDraft(storage);
  return draft;
}

/** Persist a draft and report whether the storage write actually happened. */
export function writeDraft(
  storage: Storage | null,
  values: DraftValues,
  savedAt = Date.now(),
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: DRAFT_VERSION, savedAt, values }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Remove the draft, tolerating disabled or throwing storage. */
export function removeDraft(storage: Storage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, quota, policy). The form still works.
  }
}
