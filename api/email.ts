import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SendResult } from "../Shared/Interfaces/EmailResponse.interface";
import {
  InfeasibleAssignmentError,
  InvalidParticipantsError,
  sortEventMembers,
} from "../Shared/business/Sorter.js";
import { parseRequestBody } from "./_lib/body.js";
import { HttpError, RateLimitError } from "./_lib/errors.js";
import { assertAllowedOrigin, enforceRateLimit } from "./_lib/guard.js";
import { createTransporter, sendAssignmentEmails } from "./_lib/mail.js";
import { newRunId, sealToken } from "./_lib/token.js";
import { validateEvent } from "./_lib/validation.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed.");
    }

    assertAllowedOrigin(req);
    enforceRateLimit(req, "email");

    const event = validateEvent(parseRequestBody(req.body));

    if (!process.env.MAIL_ADDRESS || !process.env.MAIL_PASSWORD) {
      throw new HttpError(500, "Mail credentials not configured on server.");
    }
    if (!process.env.SORTER_SECRET) {
      throw new HttpError(500, "SORTER_SECRET not configured on server.");
    }

    const assignments = sortEventMembers(event.participants, {
      exclusions: event.exclusions,
    });
    const runId = newRunId();
    const token = sealToken({
      runId,
      event: {
        name: event.name,
        date: event.date,
        giftPrice: event.giftPrice,
        currency: event.currency,
      },
      assignments,
    });

    const transporter = createTransporter();
    try {
      await transporter.verify();
    } catch {
      throw new HttpError(500, "SMTP configuration invalid.");
    }

    const outcome = await sendAssignmentEmails(transporter, event, assignments);
    console.log(`[sorter] run=${runId} sent=${outcome.sent} failed=${outcome.failed.length}`);

    const payload: SendResult = {
      success: outcome.failed.length === 0,
      runId,
      token,
      sent: outcome.sent,
      failedCount: outcome.failed.length,
      failures: outcome.failed,
      deduped: event.deduped,
    };
    res.status(200).json(payload);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error instanceof RateLimitError) {
        res.setHeader("Retry-After", String(error.retryAfter));
      }
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof InfeasibleAssignmentError || error instanceof InvalidParticipantsError) {
      res.status(422).json({ error: error.message });
      return;
    }

    console.error("[sorter] unexpected error", error);
    res.status(500).json({ error: "Internal server error." });
  }
}
