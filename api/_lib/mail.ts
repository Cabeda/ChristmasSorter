import { createTransport, type SendMailOptions, type Transporter } from "nodemailer";
import type Member from "../../Shared/Interfaces/Member.interface";
import { formatGiftPrice } from "../../Shared/business/currency.js";
import { formatEventDate } from "../../Shared/business/date.js";

export interface EventDetails {
  name: string;
  date: string;
  giftPrice: string;
  currency: string;
}

export interface Recipient {
  from: Member;
  to: Member;
}

export interface SendFailure {
  email: string;
  reason: string;
}

export interface SendOutcome {
  sent: number;
  failed: SendFailure[];
}

export interface SendOptions {
  /**
   * Stop handing messages to SMTP after this many milliseconds. The rest are
   * reported as failures so the caller can return the token and retry them.
   */
  budgetMs?: number;
}

/**
 * Kept below the 60s function limit, leaving room for SMTP verify, token
 * sealing, and the response. Unsent recipients are reported for a retry.
 */
export const DEFAULT_SEND_BUDGET_MS = 45_000;
const SMTP_CONNECTION_TIMEOUT_MS = 5_000;
const SMTP_GREETING_TIMEOUT_MS = 5_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;
export const TIME_BUDGET_EXHAUSTED = "time budget exhausted";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape a value before interpolating it into the HTML email. Names and emails
 * come from the organizer, so never trust them.
 *
 * @param value Raw text.
 * @returns HTML-safe text.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);
}

/**
 * Build the email one participant receives. The recipient only ever sees the
 * person they must buy a gift for, never the whole draw.
 *
 * @param event Event details.
 * @param recipient The giver and their assignment.
 * @returns A nodemailer message.
 */
export function generateBody(event: EventDetails, recipient: Recipient): SendMailOptions {
  const formattedDate = formatEventDate(event.date);
  const price = formatGiftPrice(event.giftPrice, event.currency);
  const subject = `${event.name.replace(/[\r\n]+/g, " ")} — Amigo Secreto`;

  const textBody = [
    `Olá ${recipient.from.name},`,
    "",
    `Você foi sorteado para o Amigo Secreto "${event.name}" em ${formattedDate}.`,
    `Orçamento: ${price}`,
    `Presente para: ${recipient.to.name} (${recipient.to.email})`,
    "",
    "Boas festas e boas trocas de presentes!",
  ].join("\n");

  const htmlBody = `
    <p>Olá <strong>${escapeHtml(recipient.from.name)}</strong>,</p>
    <p>Você foi sorteado para o <strong>Amigo Secreto</strong> <em>${escapeHtml(event.name)}</em> no dia <strong>${escapeHtml(formattedDate)}</strong>.</p>
    <ul>
      <li><strong>Orçamento:</strong> ${escapeHtml(price)}</li>
      <li><strong>Presente para:</strong> ${escapeHtml(recipient.to.name)} (${escapeHtml(recipient.to.email)})</li>
    </ul>
    <p>Boas festas e boas trocas de presentes!</p>
    <hr />
    <p style="font-size:0.9em;color:#666;">Enviado por ${escapeHtml(process.env.MAIL_ADDRESS ?? "")}</p>
  `;

  return {
    from: process.env.MAIL_ADDRESS ?? "",
    to: recipient.from.email,
    subject,
    text: textBody,
    html: htmlBody,
  };
}

/**
 * Create the SMTP transport. Gmail is the default, and the host, port, and
 * TLS mode can be overridden with `SMTP_*` environment variables.
 */
export function createTransporter(): Transporter {
  return createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: process.env.MAIL_ADDRESS,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

/**
 * Send every assignment sequentially. Sequential sends keep us under SMTP
 * rate limits, and one failure never stops the rest. The time budget stops
 * before the serverless function is killed, so the caller still gets a token
 * and the unsent recipients can be retried.
 *
 * @param transporter The SMTP transport.
 * @param event Event details.
 * @param assignments The draw.
 * @param options Time budget.
 * @returns How many were sent and which recipients failed.
 */
export async function sendAssignmentEmails(
  transporter: Transporter,
  event: EventDetails,
  assignments: Recipient[],
  options: SendOptions = {},
): Promise<SendOutcome> {
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_SEND_BUDGET_MS);
  let sent = 0;
  const failed: SendFailure[] = [];

  for (const recipient of assignments) {
    if (Date.now() >= deadline) {
      failed.push({ email: recipient.from.email, reason: TIME_BUDGET_EXHAUSTED });
      continue;
    }

    try {
      await transporter.sendMail(generateBody(event, recipient));
      sent += 1;
    } catch (error) {
      failed.push({
        email: recipient.from.email,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { sent, failed };
}
