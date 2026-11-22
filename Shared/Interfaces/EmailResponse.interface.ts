export interface SendFailure {
  email: string;
  reason: string;
}

/** Response from `POST /api/email`. Never contains the drawn pairs. */
export interface SendResult {
  success: boolean;
  runId: string;
  /** Opaque, encrypted mapping token used by `POST /api/retry`. */
  token: string;
  sent: number;
  failedCount: number;
  failures: SendFailure[];
  deduped: number;
}

/** Response from `POST /api/retry`. Never contains the drawn pairs. */
export interface RetryResult {
  success: boolean;
  runId: string;
  sent: number;
  failedCount: number;
  failures: SendFailure[];
}
