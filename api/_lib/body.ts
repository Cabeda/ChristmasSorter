import { HttpError } from "./errors.js";

/**
 * Vercel parses JSON bodies, but a raw string can still arrive from other
 * clients. Parse it here so both endpoints share one behaviour.
 *
 * @param body The request body.
 * @returns The parsed value.
 * @throws {HttpError} 400 when a string body is not valid JSON.
 */
export function parseRequestBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}
