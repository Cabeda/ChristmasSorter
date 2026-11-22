import { memo } from "react";
import type { UseFormRegister } from "react-hook-form";
import type { FormInputs } from "../lib/formModel";
import styles from "./RegistrationForm.module.css";

interface ParticipantRowProps {
  index: number;
  register: UseFormRegister<FormInputs>;
  onRemove: (index: number) => void;
  nameError?: string | undefined;
  emailError?: string | undefined;
}

/**
 * One participant row. Memoized so typing in one row never re-renders the
 * others; only a validation change or a removal reaches them.
 */
export const ParticipantRow = memo(function ParticipantRow({
  index,
  register,
  onRemove,
  nameError,
  emailError,
}: ParticipantRowProps) {
  const number = index + 1;

  return (
    <div className={styles.participant} role="group" aria-label={`Participante ${number}`}>
      <div className={styles.participantHeader}>
        <span className={styles.participantNumber} aria-hidden>
          {String(number).padStart(2, "0")}
        </span>
        <span className={styles.participantTag} aria-hidden>
          presente {number}
        </span>
        <button
          type="button"
          className={styles.removeButton}
          onClick={() => onRemove(index)}
          aria-label={`Remover participante ${number}`}
        >
          <span aria-hidden>×</span>
          <span className={styles.removeLabel}>Remover</span>
        </button>
      </div>

      <div className={styles.row}>
        <label htmlFor={`p-name-${index}`} className={styles.visuallyHidden}>
          Nome do participante {number}
        </label>
        <input
          id={`p-name-${index}`}
          placeholder="Nome"
          autoComplete="name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `p-name-${index}-error` : undefined}
          className={`${styles.input} ${nameError ? styles.inputError : ""}`}
          {...register(`participants.${index}.name` as const)}
        />

        <label htmlFor={`p-email-${index}`} className={styles.visuallyHidden}>
          E-mail do participante {number}
        </label>
        <input
          id={`p-email-${index}`}
          type="email"
          inputMode="email"
          placeholder="E-mail"
          autoComplete="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `p-email-${index}-error` : undefined}
          className={`${styles.input} ${emailError ? styles.inputError : ""}`}
          {...register(`participants.${index}.email` as const)}
        />
      </div>

      {nameError && (
        <p id={`p-name-${index}-error`} className={styles.fieldError} role="alert">
          {nameError}
        </p>
      )}
      {emailError && (
        <p id={`p-email-${index}-error`} className={styles.fieldError} role="alert">
          {emailError}
        </p>
      )}
    </div>
  );
});
