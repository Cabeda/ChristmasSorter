import { useCallback, useEffect, useRef } from "react";
import { formatEventDate } from "../../Shared/business/date";
import { formatGiftPrice } from "../../Shared/business/currency";
import type { FormOutput } from "../lib/formModel";
import styles from "./RegistrationForm.module.css";

interface ConfirmDialogProps {
  values: FormOutput;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation receipt. Traps focus while open, closes on Escape, and returns
 * focus to the control that opened it.
 */
export function ConfirmDialog({ values, loading, onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const loadingRef = useRef(loading);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const requestCancel = useCallback(() => {
    if (loadingRef.current) return;
    onCancel();
  }, [onCancel]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (loadingRef.current) return;
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      if (loadingRef.current) {
        event.preventDefault();
        (dialogRef.current as HTMLDivElement).focus();
        return;
      }

      const cancel = cancelRef.current as HTMLButtonElement;
      const confirm = confirmRef.current as HTMLButtonElement;
      if (document.activeElement !== cancel && document.activeElement !== confirm) {
        event.preventDefault();
        cancel.focus();
        return;
      }
      if (event.shiftKey) {
        if (document.activeElement === cancel) {
          event.preventDefault();
          confirm.focus();
        }
        return;
      }
      if (document.activeElement === confirm) {
        event.preventDefault();
        cancel.focus();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (confirmRef.current as HTMLButtonElement).focus();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previouslyFocused as HTMLElement).focus();
    };
  }, [onKeyDown]);

  useEffect(() => {
    if (!loading) return;
    (dialogRef.current as HTMLDivElement).focus();
  }, [loading]);

  return (
    <div className={styles.modalOverlay} onClick={requestCancel}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-busy={loading}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-copy"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.modalKicker} aria-hidden>
          ★ atestado de sorteio ★
        </p>
        <h3 id="confirm-title" className={styles.modalHeader}>
          Confirmar envio
        </h3>
        <p id="confirm-copy" className={styles.modalCopy}>
          Vamos sortear e enviar um e-mail para cada participante com o nome do
          seu amigo secreto. Confira a ficha:
        </p>

        <dl className={styles.receipt}>
          <div className={styles.receiptRow}>
            <dt>Evento</dt>
            <dd>{values.eventName}</dd>
          </div>
          <div className={styles.receiptRow}>
            <dt>Data</dt>
            <dd>{formatEventDate(values.eventDate.toISOString())}</dd>
          </div>
          <div className={styles.receiptRow}>
            <dt>Participantes</dt>
            <dd>{values.participants.length}</dd>
          </div>
          <div className={styles.receiptRow}>
            <dt>Preço máximo</dt>
            <dd>{formatGiftPrice(values.price, values.currency)}</dd>
          </div>
        </dl>

        <p className={styles.modalNote}>
          Cada pessoa recebe apenas o seu próprio par. O organizador também participa
          e também não vê os pares.
        </p>

        <div className={styles.modalActions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.secondaryButton}
            onClick={requestCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.primary}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Enviando..." : "Confirmar e enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
