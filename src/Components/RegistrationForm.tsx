import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import type {
  RetryResult,
  SendResult,
} from "../../Shared/Interfaces/EmailResponse.interface";
import type SorterEvent from "../../Shared/Interfaces/SorterEvent.Interface";
import { useDraft } from "../hooks/useDraft";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { readDraft, getStorage } from "../lib/draft";
import {
  DEFAULT_VALUES,
  Schema,
  type FormInputs,
  type FormOutput,
} from "../lib/formModel";
import { ConfirmDialog } from "./ConfirmDialog";
import { ParticipantRow } from "./ParticipantRow";
import styles from "./RegistrationForm.module.css";

type PendingRetry = {
  token: string;
  emails: string[];
  count: number;
};

type StatusMessage = { type: "success" | "error"; text: string };

export default function RegistrationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [clicks, setClicks] = useState(0);
  const [santaMode, setSantaMode] = useState(false);
  const [pendingSend, setPendingSend] = useState<FormOutput | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const [retrying, setRetrying] = useState(false);
  const online = useOnlineStatus();

  const [initialDraft] = useState(() => readDraft(getStorage()));

  const {
    control,
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInputs, unknown, FormOutput>({
    resolver: zodResolver(Schema) as unknown as Resolver<FormInputs, unknown, FormOutput>,
    defaultValues: initialDraft ? initialDraft.values : DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const { hasDraft, notice, clearDraft, markSent } = useDraft(
    { watch, reset },
    DEFAULT_VALUES,
    initialDraft,
  );

  const removeParticipant = useCallback((index: number) => remove(index), [remove]);
  const handleCancel = useCallback(() => setPendingSend(null), []);
  const handleClearDraft = useCallback(() => {
    clearDraft();
    (document.getElementById("eventName") as HTMLInputElement).focus();
  }, [clearDraft]);

  const toggleSanta = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 7) {
      setSantaMode(!santaMode);
      setClicks(0);
    }
  };

  const send = async (data: FormOutput) => {
    setSubmitting(true);
    setStatusMessage(null);
    setPendingRetry(null);

    const body: SorterEvent = {
      name: data.eventName,
      participants: data.participants,
      date: data.eventDate,
      giftPrice: data.price,
      currency: data.currency,
      exclusions: [],
    };

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as SendResult & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "");

      if (payload.failedCount > 0) {
        setPendingRetry({
          token: payload.token,
          emails: payload.failures.map((failure) => failure.email),
          count: payload.failedCount,
        });
        setStatusMessage({
          type: "error",
          text: `${payload.sent} convites enviados; ${payload.failedCount} falharam.`,
        });
      } else {
        setStatusMessage({
          type: "success",
          text: santaMode ? "Ho Ho Ho! Convites enviados 🎅🎄" : "Convites enviados com sucesso.",
        });
        markSent();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatusMessage({
        type: "error",
        text: message || "Falha ao enviar convites. Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onValid = (data: FormOutput) => {
    if (!online) return;
    setPendingSend(data);
  };

  const handleConfirm = async () => {
    const values = pendingSend as FormOutput;
    setConfirmLoading(true);
    try {
      await send(values);
    } finally {
      setConfirmLoading(false);
      setPendingSend(null);
    }
  };

  const handleRetry = async (retry: PendingRetry) => {
    setRetrying(true);
    try {
      const res = await fetch("/api/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ token: retry.token, emails: retry.emails }),
      });
      const payload = (await res.json()) as RetryResult & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "");

      if (payload.failedCount > 0) {
        setPendingRetry({
          token: retry.token,
          emails: payload.failures.map((failure) => failure.email),
          count: payload.failedCount,
        });
        setStatusMessage({
          type: "error",
          text: `${payload.sent} reenviados; ${payload.failedCount} continuam a falhar.`,
        });
      } else {
        setPendingRetry(null);
        setStatusMessage({ type: "success", text: "Reenvio concluído." });
        markSent();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatusMessage({
        type: "error",
        text: message || "Falha no reenvio. Tente novamente.",
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className={`${styles.form} ${santaMode ? styles.santaMode : ""}`}
      noValidate
    >
      <div className={styles.formHeader}>
        <div>
          <h2 className={styles.title}>Ficha do sorteio</h2>
          <p className={styles.subtitle}>
            Preencha a ficha, confira os dados e envie. O sorteio é confidencial.
          </p>
        </div>
        <button
          type="button"
          className={styles.santaButton}
          onClick={toggleSanta}
          aria-pressed={santaMode}
          aria-label="Cabeçalho festivo"
          title="Cabeçalho festivo"
        >
          <span aria-hidden>{santaMode ? "🎅" : "★"}</span>
        </button>
      </div>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>
          <span className={styles.step} aria-hidden>
            01
          </span>
          O evento
        </legend>

        <div className={styles.field}>
          <label htmlFor="eventName">Nome do evento</label>
          <input
            id="eventName"
            autoComplete="off"
            aria-invalid={Boolean(errors.eventName)}
            aria-describedby={errors.eventName ? "eventName-error" : undefined}
            className={`${styles.input} ${errors.eventName ? styles.inputError : ""}`}
            {...register("eventName")}
          />
          {errors.eventName && (
            <p id="eventName-error" className={styles.fieldError} role="alert">
              {errors.eventName.message}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="eventDate">Data do evento</label>
          <input
            id="eventDate"
            type="date"
            aria-invalid={Boolean(errors.eventDate)}
            aria-describedby={errors.eventDate ? "eventDate-error" : undefined}
            className={`${styles.input} ${errors.eventDate ? styles.inputError : ""}`}
            {...register("eventDate")}
          />
          {errors.eventDate && (
            <p id="eventDate-error" className={styles.fieldError} role="alert">
              {errors.eventDate.message}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>
          <span className={styles.step} aria-hidden>
            02
          </span>
          O presente
        </legend>

        <div className={styles.giftGrid}>
          <div className={styles.field}>
            <label htmlFor="price">Preço máximo</label>
            <input
              id="price"
              type="number"
              inputMode="numeric"
              min={0}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? "price-error price-hint" : "price-hint"}
              className={`${styles.input} ${errors.price ? styles.inputError : ""}`}
              {...register("price")}
            />
            {errors.price && (
              <p id="price-error" className={styles.fieldError} role="alert">
                {errors.price.message}
              </p>
            )}
            <p id="price-hint" className={styles.hint}>
              Só números, sem símbolos. Exemplo: 20
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="currency">Moeda</label>
            <select
              id="currency"
              aria-invalid={Boolean(errors.currency)}
              aria-describedby={errors.currency ? "currency-error" : undefined}
              className={`${styles.input} ${styles.select} ${errors.currency ? styles.inputError : ""}`}
              {...register("currency")}
            >
              <option value="euro">Euro (€)</option>
              <option value="dollar">Dólar ($)</option>
              <option value="pound">Libra (£)</option>
            </select>
            {errors.currency && (
              <p id="currency-error" className={styles.fieldError} role="alert">
                {errors.currency.message}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <section className={styles.section} aria-labelledby="participants-title">
        <div className={styles.participantToolbar}>
          <h3 id="participants-title" className={styles.legend}>
            <span className={styles.step} aria-hidden>
              03
            </span>
            Participantes
          </h3>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => append({ name: "", email: "" })}
            aria-label="Adicionar participante"
          >
            <span aria-hidden>+</span>
            Adicionar
          </button>
        </div>

        <div className={styles.participantList}>
          {fields.map((field, index) => {
            const participantErrors = errors.participants?.[index];
            return (
              <ParticipantRow
                key={field.id}
                index={index}
                register={register}
                onRemove={removeParticipant}
                nameError={participantErrors?.name?.message}
                emailError={participantErrors?.email?.message}
              />
            );
          })}
        </div>

        {errors.participants?.root && (
          <p className={styles.fieldError} role="alert">
            {errors.participants.root.message}
          </p>
        )}
      </section>

      {!online && (
        <div id="offline-message" className={styles.offline} role="status" aria-live="polite">
          <strong>Sem ligação à internet.</strong> O rascunho continua guardado neste
          dispositivo. O envio volta a ficar disponível assim que a ligação regressar.
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.primary}
          disabled={submitting || pendingRetry !== null || !online}
          aria-busy={submitting}
          aria-describedby={!online ? "offline-message" : undefined}
        >
          {submitting
            ? santaMode
              ? "Ho Ho Ho..."
              : "Enviando..."
            : santaMode
              ? "Sortear — Ho Ho Ho!"
              : "Sortear!"}
        </button>
      </div>

      {pendingRetry && (
        <div className={styles.retryBox}>
          <p className={styles.retryCopy}>
            {pendingRetry.count} convite(s) não chegaram. Pode reenviar apenas esses.
          </p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => void handleRetry(pendingRetry)}
            disabled={retrying}
          >
            {retrying ? "Reenviando..." : `Reenviar ${pendingRetry.count} falha(s)`}
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          className={
            statusMessage.type === "success" ? styles.success : styles.errorMessage
          }
          role="status"
          aria-live="polite"
        >
          {statusMessage.text}
          {statusMessage.type === "success" && (
            <span className={styles.sparkles} aria-hidden>
              ✦ ✦ ✦
            </span>
          )}
        </div>
      )}

      <div className={styles.ticket}>
        <p className={styles.hint}>
          <strong>Como funciona:</strong> ao enviar, o sistema faz o sorteio
          aleatório e manda por e-mail o nome do amigo secreto de cada pessoa. Os
          resultados são confidenciais — cada participante só recebe o seu.
        </p>
        <span className={styles.ticketStamp} aria-hidden>
          confidencial
        </span>
      </div>

      {(hasDraft || notice === "cleared") && (
        <div className={styles.draftBar}>
          <p className={styles.draftText} aria-live="polite">
            {notice === "restored" && "Rascunho restaurado neste dispositivo."}
            {notice === "synced" && "Rascunho sincronizado de outra aba."}
            {notice === "saved" && "Rascunho guardado automaticamente."}
            {notice === "cleared" && "Rascunho limpo."}
          </p>
          {hasDraft && (
            <button type="button" className={styles.draftClear} onClick={handleClearDraft}>
              Limpar rascunho
            </button>
          )}
        </div>
      )}

      {pendingSend && (
        <ConfirmDialog
          values={pendingSend}
          loading={confirmLoading}
          onCancel={handleCancel}
          onConfirm={() => void handleConfirm()}
        />
      )}
    </form>
  );
}
