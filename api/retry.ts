import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { RetryResult } from "../Shared/Interfaces/EmailResponse.interface";
import { parseRequestBody } from "./_lib/body.js";
import { HttpError, RateLimitError } from "./_lib/errors.js";
import { assertAllowedOrigin, enforceRateLimit } from "./_lib/guard.js";
import { createTransporter, sendAssignmentEmails } from "./_lib/mail.js";
import { openToken } from "./_lib/token.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed.");
    }

    assertAllowedOrigin(req);
    enforceRateLimit(req, "retry");

    const payload = parseRequestBody(req.body);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new HttpError(400, "Request body must be an object.");
    }

    const { token, emails } = payload as { token?: unknown; emails?: unknown };
    if (typeof token !== "string" || token === "") {
      throw new HttpError(400, "A token is required.");
    }
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new HttpError(400, "A non-empty list of emails is required.");
    }

    const wanted = new Set<string>();
    for (const value of emails) {
      if (typeof value !== "string" || value.trim() === "") {
        throw new HttpError(400, "Each email must be a non-empty string.");
      }
      wanted.add(value.trim().toLowerCase());
    }

    if (!process.env.SORTER_SECRET) {
      throw new HttpError(500, "SORTER_SECRET not configured on server.");
    }

    const draw = openToken(token);
    const assignments = draw.assignments.filter((assignment) =>
      wanted.has(assignment.from.email.toLowerCase()),
    );
    if (assignments.length === 0) {
      throw new HttpError(400, "No recipients from this token match the requested emails.");
    }

    if (!process.env.MAIL_ADDRESS || !process.env.MAIL_PASSWORD) {
      throw new HttpError(500, "Mail credentials not configured on server.");
    }

    const transporter = createTransporter();
    try {
      await transporter.verify();
    } catch {
      throw new HttpError(500, "SMTP configuration invalid.");
    }

    const outcome = await sendAssignmentEmails(transporter, draw.event, assignments);
    console.log(`[sorter] retry run=${draw.runId} sent=${outcome.sent} failed=${outcome.failed.length}`);

    const result: RetryResult = {
      success: outcome.failed.length === 0,
      runId: draw.runId,
      sent: outcome.sent,
      failedCount: outcome.failed.length,
      failures: outcome.failed,
    };
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error instanceof RateLimitError) {
        res.setHeader("Retry-After", String(error.retryAfter));
      }
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[sorter] unexpected retry error", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
