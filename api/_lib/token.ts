import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type Member from "../../Shared/Interfaces/Member.interface";
import { TokenError } from "./errors.js";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export interface TokenEvent {
  name: string;
  date: string;
  giftPrice: string;
  currency: string;
}

export interface TokenAssignment {
  from: Member;
  to: Member;
}

/**
 * The sealed draw. It never leaves the server in plain text: the token is the
 * only thing the browser receives, and it is opaque without `SORTER_SECRET`.
 */
export interface TokenPayload {
  runId: string;
  event: TokenEvent;
  assignments: TokenAssignment[];
}

function encryptionKey(): Buffer {
  const secret = process.env.SORTER_SECRET;
  if (!secret) {
    throw new Error("SORTER_SECRET is not configured.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function newRunId(): string {
  return randomUUID();
}

/**
 * Encrypt a draw into an opaque, tamper-evident token.
 *
 * @param payload The draw to seal.
 * @returns `v1.<iv>.<tag>.<ciphertext>` in base64url.
 */
export function sealToken(payload: TokenPayload): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt a token created by {@link sealToken}.
 *
 * @param token The opaque token.
 * @returns The sealed draw.
 * @throws {TokenError} When the token is malformed, tampered, or expired.
 */
export function openToken(token: string): TokenPayload {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new TokenError("Malformed token.");
  }

  const iv = parts[1]!;
  const tag = parts[2]!;
  const ciphertext = parts[3]!;

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(plaintext);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as TokenPayload).assignments)
    ) {
      throw new TokenError("Invalid token payload.");
    }

    return parsed as TokenPayload;
  } catch (error) {
    if (error instanceof TokenError) throw error;
    throw new TokenError("Invalid or expired token.");
  }
}
