import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReset, UseFormWatch } from "react-hook-form";
import {
  DRAFT_DEBOUNCE_MS,
  DRAFT_STORAGE_KEY,
  getStorage,
  parseDraft,
  removeDraft,
  toDraftValues,
  writeDraft,
  type Draft,
  type DraftValues,
} from "../lib/draft";
import type { FormInputs } from "../lib/formModel";

export type DraftNotice = "restored" | "saved" | "synced" | "cleared";

interface DraftFormApi {
  watch: UseFormWatch<FormInputs>;
  reset: UseFormReset<FormInputs>;
}

interface DraftState {
  hasDraft: boolean;
  notice: DraftNotice | null;
  clearDraft: () => void;
  markSent: () => void;
}

/**
 * Keep the form in localStorage while the user types, restore it on the next
 * visit, and mirror writes from other tabs. Writes are debounced so typing
 * never touches storage on every keypress.
 */
export function useDraft(
  { watch, reset }: DraftFormApi,
  defaults: FormInputs,
  initialDraft: Draft | null,
): DraftState {
  const [hasDraft, setHasDraft] = useState(initialDraft !== null);
  const [notice, setNotice] = useState<DraftNotice | null>(initialDraft ? "restored" : null);
  const lastValuesJson = useRef(
    JSON.stringify(initialDraft ? initialDraft.values : defaults),
  );
  const pending = useRef<DraftValues | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const persist = useCallback((values: DraftValues) => {
    const json = JSON.stringify(values);
    if (json === lastValuesJson.current) return;
    if (!writeDraft(getStorage(), values)) return;
    lastValuesJson.current = json;
    setHasDraft(true);
    setNotice("saved");
  }, []);

  const flush = useCallback(() => {
    cancel();
    if (pending.current !== null) {
      persist(pending.current);
      pending.current = null;
    }
  }, [cancel, persist]);

  const discard = useCallback(
    (next: DraftNotice | null) => {
      cancel();
      pending.current = null;
      removeDraft(getStorage());
      lastValuesJson.current = JSON.stringify(defaults);
      setHasDraft(false);
      setNotice(next);
      reset(defaults);
    },
    [cancel, reset, defaults],
  );

  const clearDraft = useCallback(() => discard("cleared"), [discard]);
  const markSent = useCallback(() => discard(null), [discard]);

  useEffect(() => {
    const subscription = watch((values) => {
      const normalized = toDraftValues(values);
      pending.current = normalized;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        persist(normalized);
        pending.current = null;
      }, DRAFT_DEBOUNCE_MS);
    });

    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pagehide", onPageHide);
      cancel();
    };
  }, [watch, cancel, flush, persist]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DRAFT_STORAGE_KEY) return;
      if (event.newValue === null) {
        discard("cleared");
        return;
      }
      const draft = parseDraft(event.newValue);
      if (draft === null) return;

      cancel();
      pending.current = null;
      lastValuesJson.current = JSON.stringify(draft.values);
      setHasDraft(true);
      setNotice("synced");
      reset(draft.values);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cancel, discard, reset]);

  return { hasDraft, notice, clearDraft, markSent };
}
