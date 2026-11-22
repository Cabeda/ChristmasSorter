import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import type { RetryResult, SendResult } from "../../Shared/Interfaces/EmailResponse.interface";
import Member from "../../Shared/Interfaces/Member.interface";
import SorterEvent from "../../Shared/Interfaces/SorterEvent.Interface";
import { formatGiftPrice } from "../../Shared/business/currency";
import { formatEventDate } from "../../Shared/business/date";
import styles from "./RegistrationForm.module.css";

type Inputs = {
  eventName: string;
  participants: Array<Member>;
  eventDate: Date;
  price: string;
  currency: string;
};

type PendingRetry = {
  token: string;
  emails: string[];
  count: number;
};

const MemberSchema = z.object({
  name: z.string().nonempty("Nome é obrigatório"),
  email: z.string().email("Insira um e-mail válido"),
});

const Schema = z.object({
  eventName: z.string().nonempty("Nome do evento é obrigatório"),
  participants: z.array(MemberSchema).min(2, "Adicione pelo menos 2 participantes"),
  eventDate: z.coerce.date(),
  price: z.string().nonempty("Preço é obrigatório"),
  currency: z.string().nonempty("Moeda é obrigatória"),
});

export default function RegistrationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<null | { type: "success" | "error"; text: string }>(null);
  const [clicks, setClicks] = useState(0);
  const [santaMode, setSantaMode] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const [retrying, setRetrying] = useState(false);

  const {
    control,
    register,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: zodResolver(Schema) as any,
    defaultValues: {
      eventName: "Amigo Secreto",
      eventDate: new Date(),
      price: "5",
      currency: "euro",
      participants: [
        { name: "", email: "" },
        { name: "", email: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowConfirm(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  const toggleSanta = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 7) {
      setSantaMode(!santaMode);
      setClicks(0);
    }
  };

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setSubmitting(true);
    setStatusMessage(null);
    setPendingRetry(null);

    const body: SorterEvent = {
      name: data.eventName,
      participants: data.participants,
      date: new Date(data.eventDate),
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
        reset();
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

  const openConfirm = async () => {
    const valid = await trigger();
    if (valid) setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      await onSubmit(getValues() as Inputs);
    } finally {
      setConfirmLoading(false);
      setShowConfirm(false);
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
      onSubmit={(event) => {
        event.preventDefault();
        void openConfirm();
      }}
      className={`${styles.form} ${santaMode ? styles.santaMode : ""}`}
      noValidate
    >
      <div
        className={styles.header}
        onClick={toggleSanta}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleSanta();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Cabeçalho festivo"
      >
        <h2 className={styles.title}>🎄 Registro do Amigo Secreto</h2>
        <p className={styles.subtitle}>Organize seu Amigo Secreto de forma rápida e divertida</p>
        <div className={styles.ornament} aria-hidden>⚪️</div>
      </div>

      <div className={styles.snow} aria-hidden>
        <span className={styles.snowflake}>❄</span>
        <span className={styles.snowflake}>❄</span>
        <span className={styles.snowflake}>❄</span>
      </div>

      <fieldset className={styles.fieldset}>
        <label htmlFor="eventName">Nome do evento</label>
        <input
          id="eventName"
          aria-invalid={Boolean(errors.eventName)}
          aria-describedby={errors.eventName ? "eventName-error" : undefined}
          className={`${styles.input} ${errors.eventName ? styles.error : ""}`}
          {...register("eventName")}
        />
        {errors.eventName && (
          <p id="eventName-error" className={styles.fieldError} role="alert">
            {errors.eventName.message}
          </p>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <label htmlFor="eventDate">Data do evento</label>
        <input
          id="eventDate"
          type="date"
          aria-invalid={Boolean(errors.eventDate)}
          className={`${styles.input} ${errors.eventDate ? styles.error : ""}`}
          {...register("eventDate")}
        />
        {errors.eventDate && <p className={styles.fieldError}>{errors.eventDate.message}</p>}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <label htmlFor="price">Preço máximo</label>
        <input
          id="price"
          type="number"
          inputMode="numeric"
          min={0}
          aria-invalid={Boolean(errors.price)}
          className={`${styles.input} ${errors.price ? styles.error : ""}`}
          {...register("price")}
        />
        {errors.price && <p className={styles.fieldError}>{errors.price.message}</p>}
        <p className={styles.hint}>Digite apenas números — sem símbolos (ex: 20)</p>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <label htmlFor="currency">Moeda</label>
        <select
          id="currency"
          className={`${styles.input} ${errors.currency ? styles.error : ""}`}
          {...register("currency")}
        >
          <option value="euro">Euro (€)</option>
          <option value="dollar">Dólar ($)</option>
          <option value="pound">Libra (£)</option>
        </select>
        {errors.currency && <p className={styles.fieldError}>{errors.currency.message}</p>}
      </fieldset>

      <div className={styles.participantHeader}>
        <label>Participantes</label>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => append({ name: "", email: "" })}
          aria-label="Adicionar participante"
        >
          ➕
        </button>
      </div>

      {fields.map((field, index) => {
        const participantErrors = errors.participants?.[index];
        return (
          <section className={styles.participant} key={field.id}>
            <div className={styles.row} role="group" aria-label={`Participante ${index + 1}`}>
              <label htmlFor={`p-name-${index}`} className={styles.visuallyHidden}>
                Nome do participante {index + 1}
              </label>
              <input
                id={`p-name-${index}`}
                placeholder="Nome"
                className={`${styles.input} ${participantErrors?.name ? styles.error : ""}`}
                {...register(`participants.${index}.name` as const)}
              />
              <label htmlFor={`p-email-${index}`} className={styles.visuallyHidden}>
                E-mail do participante {index + 1}
              </label>
              <input
                id={`p-email-${index}`}
                placeholder="E-mail"
                className={`${styles.input} ${participantErrors?.email ? styles.error : ""}`}
                {...register(`participants.${index}.email` as const)}
              />
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => remove(index)}
                aria-label={`Remover participante ${index + 1}`}
              >
                Remover
              </button>
            </div>

            {participantErrors && (
              <div className={styles.fieldError} role="alert">
                {participantErrors.name?.message}
                {participantErrors.email?.message && <div>{participantErrors.email.message}</div>}
              </div>
            )}
          </section>
        );
      })}

      {errors.participants?.root && (
        <p className={styles.fieldError}>{errors.participants.root.message}</p>
      )}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.primary}
          disabled={submitting || pendingRetry !== null}
          aria-busy={submitting}
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
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => void handleRetry(pendingRetry)}
            disabled={retrying}
          >
            {retrying ? "Reenviando..." : `Reenviar ${pendingRetry.count} falha(s)`}
          </button>
        </div>
      )}

      <p className={styles.hint}>
        Ao enviar, o sistema fará o sorteio aleatório e enviará, por e-mail, para cada participante a pessoa que lhe foi atribuída. Os resultados são confidenciais — cada participante só recebe o seu próprio destinatário.
      </p>

      {showConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-title" className={styles.modalHeader}>Confirmar envio</h3>
            <div className={styles.modalBody}>
              <p>Você está prestes a enviar e-mails para os participantes com os resultados do sorteio. Confirme os detalhes abaixo:</p>
              <ul>
                <li><strong>Evento:</strong> {getValues().eventName}</li>
                <li><strong>Data:</strong> {formatEventDate(new Date(getValues().eventDate).toISOString())}</li>
                <li><strong>Participantes:</strong> {getValues().participants.length}</li>
                <li><strong>Preço máximo:</strong> {formatGiftPrice(getValues().price, getValues().currency)}</li>
              </ul>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setShowConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void handleConfirm()}
                disabled={confirmLoading}
                autoFocus
              >
                {confirmLoading ? "Enviando..." : "Confirmar e enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className={
            statusMessage.type === "success"
              ? `${styles.success} ${styles.confetti}`
              : styles.errorMessage
          }
          role="status"
          aria-live="polite"
        >
          {statusMessage.text}
        </div>
      )}
    </form>
  );
}
