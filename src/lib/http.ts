/** A request that exceeded its deadline and was aborted. */
export class RequestTimeoutError extends Error {
  constructor(message = "O pedido demorou demasiado. Tente novamente.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

/**
 * Long enough for the server's 50s send budget plus its function overhead,
 * short enough that a dead connection cannot leave the button stuck forever.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 65_000;

/**
 * `fetch` with an abortable deadline. A timeout becomes a friendly
 * `RequestTimeoutError`; every other failure is re-thrown untouched.
 *
 * @param input Request URL.
 * @param init Request options.
 * @param timeoutMs Deadline in milliseconds.
 * @returns The response.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
