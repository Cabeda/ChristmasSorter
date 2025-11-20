import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { SubmitHandler, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import Member from "../../Shared/Interfaces/Member.interface";
import SorterEvent from "../../Shared/Interfaces/SorterEvent.Interface";
import styles from "./RegistrationForm.module.css";

type Inputs = {
  eventName: string;
  participants: Array<Member>;
  eventDate: Date;
  price: string;
  currency: string;
};

const MemberSchema = z.object({
  name: z.string().nonempty("Nome é obrigatório"),
  email: z.string().email("Insira um e-mail válido"),
});

const dateSchema = z.preprocess((arg) => {
  if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
  return z.date();
}, z.date());

const Schema = z
  .object({
    eventName: z.string().nonempty("Nome do evento é obrigatório"),
    participants: z.array(MemberSchema).min(2, "Adicione pelo menos 2 participantes"),
    eventDate: dateSchema,
    price: z.string().nonempty("Preço é obrigatório"),
    currency: z.string().nonempty("Moeda é obrigatória"),
  })
  .required();

export default function RegistrationForm(action: any) {
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<null | { type: "success" | "error"; text: string }>(null);
  const [clicks, setClicks] = useState(0);
  const [santaMode, setSantaMode] = useState(false);

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
      participants: [{ name: "", email: "" }, { name: "", email: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "participants",
  });

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setSubmitting(true);
    setStatusMessage(null);

    const body: SorterEvent = {
      name: data.eventName,
      participants: data.participants,
      date: new Date(data.eventDate),
      giftPrice: data.price,
      currency: data.currency,
    };

    try {
      const res = await fetch(`/api/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Request failed");

      setStatusMessage({ type: "success", text: "Convites enviados com sucesso." });
      // small festive message when in santa mode
      if (santaMode) setStatusMessage({ type: "success", text: "Ho Ho Ho! Convites enviados 🎅🎄" });
      reset();
    } catch (e) {
      setStatusMessage({ type: "error", text: "Falha ao enviar convites. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirm = async () => {
    const valid = await trigger();
    if (valid) setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      const values = getValues();
      await onSubmit(values as Inputs);
    } finally {
      setConfirmLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); openConfirm(); }} className={`${styles.form} ${santaMode ? styles.santaMode : ""}`} noValidate>
      <div className={styles.header} onClick={() => {
        // playful easter egg: click 7 times to toggle santa mode
        const next = clicks + 1;
        setClicks(next);
        if (next >= 7) { setSantaMode(!santaMode); setClicks(0); }
      }} role="button" tabIndex={0} aria-label="Cabeçalho festivo">
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
          aria-invalid={!!errors.eventName}
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
          aria-invalid={!!errors.eventDate}
          className={styles.input}
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
          aria-invalid={!!errors.price}
          className={`${styles.input} ${errors.price ? styles.error : ""}`}
          {...register("price")}
        />
        {errors.price && <p className={styles.fieldError}>{errors.price.message}</p>}
        <p className={styles.hint}>Digite apenas números — sem símbolos (ex: 20)</p>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <label htmlFor="currency">Moeda</label>
        <select id="currency" className={styles.input} {...register("currency")}>
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
      {fields.map((field, index) => (
        <section className={styles.participant} key={field.id}>
          <div className={styles.row} role="group" aria-label={`Participante ${index + 1}`}>
            <label htmlFor={`p-name-${index}`} className={styles.visuallyHidden}>
              Nome do participante {index + 1}
            </label>
            <input
              id={`p-name-${index}`}
              placeholder="Nome"
              className={`${styles.input} ${errors?.participants?.[index]?.name ? styles.error : ""}`}
              {...register(`participants.${index}.name` as const)}
            />
            <label htmlFor={`p-email-${index}`} className={styles.visuallyHidden}>
              E-mail do participante {index + 1}
            </label>
            <input
              id={`p-email-${index}`}
              placeholder="E-mail"
              className={`${styles.input} ${errors?.participants?.[index]?.email ? styles.error : ""}`}
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

          {errors.participants?.[index] && (
            <div className={styles.fieldError} role="alert">
              {errors.participants?.[index]?.name?.message}
              {errors.participants?.[index]?.email?.message && (
                <div>{errors.participants?.[index]?.email?.message}</div>
              )}
            </div>
          )}
        </section>
      ))}

      {errors.participants && <p className={styles.fieldError}>{errors.participants?.message}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={submitting} aria-busy={submitting}>
          {submitting ? (santaMode ? "Ho Ho Ho..." : "Enviando...") : (santaMode ? "Sortear — Ho Ho Ho!" : "Sortear!")}
        </button>
      </div>

      <p className={styles.hint}>
        Ao enviar, o sistema fará o sorteio aleatório e enviará, por e-mail, para cada participante a pessoa que lhe foi atribuída. Os resultados são confidenciais — cada participante só recebe o seu próprio destinatário.
      </p>

      {showConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalHeader}>Confirmar envio</h3>
            <div className={styles.modalBody}>
              <p>Você está prestes a enviar e-mails para os participantes com os resultados do sorteio. Confirme os detalhes abaixo:</p>
              <ul>
                <li><strong>Evento:</strong> {getValues().eventName}</li>
                <li><strong>Data:</strong> {getValues().eventDate?.toString()}</li>
                <li><strong>Participantes:</strong> {getValues().participants?.length || 0}</li>
                <li><strong>Preço máximo:</strong> {getValues().price} {getValues().currency}</li>
              </ul>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.deleteButton} onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button type="button" className={styles.primary} onClick={handleConfirm} disabled={confirmLoading}>{confirmLoading ? 'Enviando...' : 'Confirmar e enviar'}</button>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className={statusMessage.type === "success" ? `${styles.success} ${styles.confetti}` : styles.errorMessage} role="status" aria-live="polite">
          {statusMessage.text}
        </div>
      )}
    </form>
  );
}
