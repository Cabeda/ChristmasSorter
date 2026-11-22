/** An error that maps directly to an HTTP status for the serverless handlers. */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Origin not allowed.") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class RateLimitError extends HttpError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(429, "Too many requests.");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class TokenError extends HttpError {
  constructor(message = "Invalid or expired token.") {
    super(400, message);
    this.name = "TokenError";
  }
}
