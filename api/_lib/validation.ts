import type Member from "../../Shared/Interfaces/Member.interface";
import type { ExclusionPair } from "../../Shared/Interfaces/ExclusionPair.interface";
import { ValidationError } from "./errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_PARTICIPANTS = 50;
const MAX_EVENT_NAME_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_GIFT_PRICE = 1_000_000;

/** A request that passed validation, with duplicates removed and emails normalized. */
export interface ValidatedEvent {
  name: string;
  date: string;
  giftPrice: string;
  currency: string;
  participants: Member[];
  exclusions: ExclusionPair[];
  deduped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new ValidationError(`${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${field} is too long (max ${maxLength}).`);
  }
  return trimmed;
}

function validateExclusions(
  input: unknown,
  byEmail: Map<string, Member>,
): ExclusionPair[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    throw new ValidationError("Exclusions must be an array of email pairs.");
  }

  const result: ExclusionPair[] = [];
  const seen = new Set<string>();

  for (const rawPair of input) {
    if (!Array.isArray(rawPair) || rawPair.length !== 2) {
      throw new ValidationError("Each exclusion must be a pair of emails.");
    }
    const left = requireString(rawPair[0], "Exclusion email", MAX_EMAIL_LENGTH).toLowerCase();
    const right = requireString(rawPair[1], "Exclusion email", MAX_EMAIL_LENGTH).toLowerCase();

    if (left === right) {
      throw new ValidationError("An exclusion cannot pair a participant with themselves.");
    }
    if (!byEmail.has(left) || !byEmail.has(right)) {
      throw new ValidationError("An exclusion references an email that is not a participant.");
    }

    const key = left < right ? `${left}|${right}` : `${right}|${left}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push([left, right]);
  }

  return result;
}

/**
 * Validate and normalize a `POST /api/email` body. The UI is never trusted:
 * every field is checked again here.
 *
 * @param input The parsed request body.
 * @returns A clean event ready for the sorter.
 * @throws {ValidationError} When a field is missing or invalid.
 */
export function validateEvent(input: unknown): ValidatedEvent {
  if (!isRecord(input)) {
    throw new ValidationError("Request body must be an object.");
  }

  const name = requireString(input.name, "Event name", MAX_EVENT_NAME_LENGTH);

  if (typeof input.date !== "string") {
    throw new ValidationError("Event date must be an ISO date string.");
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Event date is invalid.");
  }

  if (typeof input.giftPrice !== "string" && typeof input.giftPrice !== "number") {
    throw new ValidationError("Gift price must be a number.");
  }
  const giftPrice = String(input.giftPrice).trim();
  const numericPrice = Number(giftPrice);
  if (giftPrice === "" || !Number.isFinite(numericPrice)) {
    throw new ValidationError("Gift price must be a number.");
  }
  if (numericPrice < 0) {
    throw new ValidationError("Gift price cannot be negative.");
  }
  if (numericPrice > MAX_GIFT_PRICE) {
    throw new ValidationError(`Gift price cannot exceed ${MAX_GIFT_PRICE}.`);
  }

  const currency =
    input.currency === undefined
      ? "euro"
      : requireString(input.currency, "Currency", 12);

  if (!Array.isArray(input.participants)) {
    throw new ValidationError("Participants must be an array.");
  }
  if (input.participants.length < 2) {
    throw new ValidationError("At least two participants are required.");
  }
  if (input.participants.length > MAX_PARTICIPANTS) {
    throw new ValidationError(`At most ${MAX_PARTICIPANTS} participants are allowed.`);
  }

  const participants: Member[] = [];
  const byEmail = new Map<string, Member>();
  let deduped = 0;

  for (const rawParticipant of input.participants) {
    if (!isRecord(rawParticipant)) {
      throw new ValidationError("Each participant must be an object.");
    }
    const participantName = requireString(rawParticipant.name, "Participant name", MAX_NAME_LENGTH);
    const email = requireString(rawParticipant.email, "Participant email", MAX_EMAIL_LENGTH);
    if (!EMAIL_PATTERN.test(email)) {
      throw new ValidationError(`Participant email is invalid: ${email}`);
    }

    const key = email.toLowerCase();
    if (byEmail.has(key)) {
      deduped += 1;
      continue;
    }

    const member: Member = { name: participantName, email };
    byEmail.set(key, member);
    participants.push(member);
  }

  if (participants.length < 2) {
    throw new ValidationError("At least two participants with distinct emails are required.");
  }

  const exclusions = validateExclusions(input.exclusions, byEmail);

  return {
    name,
    date: date.toISOString(),
    giftPrice,
    currency,
    participants,
    exclusions,
    deduped,
  };
}
